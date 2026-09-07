import {
  RewindToCheckpointInputSchema,
  RewindToCheckpointOutputSchema,
  type RewindToCheckpointInput,
} from "@third-chair/contracts";
import { rewindToCheckpoint as rewindCommand, type RewindDependencies } from "@third-chair/engine";
import { toMcpResult, type ToolResult } from "../result.js";
import { computePlayerViewId } from "./get-table-view.js";

export const rewindToCheckpointDescriptor = {
  name: "rewind_to_checkpoint",
  description: "Use this when Bill explicitly confirms replacing the current campaign state with a checkpoint while preserving the abandoned branch as immutable history.",
  inputSchema: RewindToCheckpointInputSchema.shape,
  outputSchema: RewindToCheckpointOutputSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true },
} as const;

export function rewindToCheckpoint(
  deps: RewindDependencies,
  rawInput: RewindToCheckpointInput,
): ToolResult {
  const rewound = rewindCommand(deps, rawInput);
  const checkpoint = {
    id: rewound.checkpoint.id,
    label: rewound.checkpoint.label,
    reason: rewound.checkpoint.reason,
    stateVersion: rewound.checkpoint.stateVersion,
    createdAt: rewound.checkpoint.createdAt,
  };
  const payload = {
    checkpoint,
    abandonedBranchId: rewound.abandonedBranchId,
    activeBranchId: rewound.activeBranchId,
    stateVersion: rewound.stateVersion,
    currentDecision: rewound.currentDecision,
    playerViewId: computePlayerViewId(
      rewound.checkpoint.campaignId,
      rewound.stateVersion,
      "RAVEN",
      rewound.currentStateHash,
    ),
  };
  return toMcpResult(
    RewindToCheckpointOutputSchema,
    payload,
    `Rewound to “${rewound.checkpoint.label}.” The previous branch remains preserved.`,
  );
}
