import { z } from "zod";
import { DecisionRequestSchema } from "./decisions.js";
import { WorldOperationSchema } from "./operations.js";

const Text = z.string().trim().min(1).max(2_000);
export const TurnProposalSchema = z.object({
  uncontestedOperations: z.array(WorldOperationSchema),
  checkLinkedOperations: z.array(WorldOperationSchema),
  memoryWrites: z.array(z.object({ audience: z.enum(["PUBLIC", "PARTY", "BILL", "RAVEN", "DIRECTOR"]), text: Text }).strict()),
  riskTags: z.array(Text),
  nextDecision: DecisionRequestSchema,
  narrativeBrief: z.object({ summary: Text, requiredResolutionIds: z.array(z.string()), requiredEventIds: z.array(z.string()) }).strict(),
}).strict();
export type TurnProposal = z.infer<typeof TurnProposalSchema>;
