import { useEffect, useState, type FormEvent } from "react";
import {
  CreateCheckpointOutputSchema,
  type CheckpointSummary,
  type SaveSetMode,
} from "@third-chair/contracts";
import type { McpTableBridge } from "../bridge/mcp-app";
import type { TableViewModel } from "../contracts";

interface CheckpointPanelProps {
  readonly view: TableViewModel;
  readonly bridge?: McpTableBridge | undefined;
  readonly refresh: () => Promise<void>;
  readonly newRequestId?: (() => string) | undefined;
}

type PendingConfirmation =
  | { readonly kind: "REWIND"; readonly checkpoint: CheckpointSummary }
  | { readonly kind: "FULL_PRIVATE_EXPORT" };

function defaultRequestId(): string {
  return crypto.randomUUID();
}

export function CheckpointPanel({
  view,
  bridge,
  refresh,
  newRequestId = defaultRequestId,
}: CheckpointPanelProps) {
  const [label, setLabel] = useState("");
  const [checkpoints, setCheckpoints] = useState<readonly CheckpointSummary[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setCheckpoints([]);
    setConfirmation(undefined);
  }, [view.playerView.campaignId]);

  const call = async (name: string, args: Record<string, unknown>) => {
    if (!bridge) throw new Error("TABLE_BRIDGE_UNAVAILABLE");
    const result = await bridge.callTool(name, args);
    if (result.isError) throw new Error("LIFECYCLE_TOOL_FAILED");
    return result;
  };

  const execute = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await action();
      await refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  const createCheckpoint = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel || !bridge) return;
    void execute(async () => {
      const result = await call("create_checkpoint", {
        campaignId: view.playerView.campaignId,
        requestId: newRequestId(),
        expectedStateVersion: view.playerView.stateVersion,
        label: trimmedLabel,
      });
      const { checkpoint } = CreateCheckpointOutputSchema.parse(result.structuredContent);
      setCheckpoints((current) => [
        ...current.filter(({ id }) => id !== checkpoint.id),
        checkpoint,
      ]);
      setLabel("");
    });
  };

  const rewind = (checkpoint: CheckpointSummary) => {
    void execute(async () => {
      await call("rewind_to_checkpoint", {
        campaignId: view.playerView.campaignId,
        checkpointId: checkpoint.id,
        requestId: newRequestId(),
        expectedStateVersion: view.playerView.stateVersion,
        confirmed: true,
      });
      setConfirmation(undefined);
    });
  };

  const exportCampaign = (mode: SaveSetMode) => {
    void execute(async () => {
      await call("export_campaign", {
        campaignId: view.playerView.campaignId,
        expectedStateVersion: view.playerView.stateVersion,
        requestId: newRequestId(),
        mode,
        confirmedSpoilers: mode === "FULL_PRIVATE",
      });
      setConfirmation(undefined);
    });
  };

  return (
    <section className="checkpoint-panel panel" aria-labelledby="checkpoint-heading">
      <div className="panel-heading">
        <div>
          <span className="kicker">Campaign record</span>
          <h2 id="checkpoint-heading">Checkpoints &amp; exports</h2>
        </div>
        <span className="panel-mark" aria-hidden="true">◇</span>
      </div>

      <form className="checkpoint-form" onSubmit={createCheckpoint}>
        <label htmlFor="checkpoint-label">Checkpoint label</label>
        <div>
          <input
            id="checkpoint-label"
            value={label}
            maxLength={200}
            onChange={(event) => setLabel(event.currentTarget.value)}
            disabled={!bridge || pending}
          />
          <button type="submit" disabled={!bridge || pending || label.trim().length === 0}>Create checkpoint</button>
        </div>
      </form>

      {checkpoints.length > 0 ? (
        <ul className="mounted-checkpoints" aria-label="Checkpoints created in this table session">
          {checkpoints.map((checkpoint) => (
            <li key={checkpoint.id}>
              <span><strong>{checkpoint.label}</strong><small>State {checkpoint.stateVersion}</small></span>
              <button
                type="button"
                disabled={!bridge || pending}
                aria-label={`Rewind to ${checkpoint.label}`}
                onClick={() => setConfirmation({ kind: "REWIND", checkpoint })}
              >Rewind</button>
            </li>
          ))}
        </ul>
      ) : <p className="quiet">New checkpoints remain available here while this table is mounted.</p>}

      <div className="export-actions" aria-label="Campaign export">
        <button type="button" disabled={!bridge || pending} onClick={() => exportCampaign("PLAYER_SAFE")}>
          Export player-safe SaveSet
        </button>
        <button
          type="button"
          disabled={!bridge || pending}
          onClick={() => setConfirmation({ kind: "FULL_PRIVATE_EXPORT" })}
        >Export full-private SaveSet</button>
      </div>

      {error ? <p role="alert">Campaign control unavailable. Refresh the table before trying again.</p> : null}

      {confirmation?.kind === "REWIND" ? (
        <div className="confirmation-panel" role="dialog" aria-modal="true" aria-labelledby="rewind-confirmation-heading">
          <h3 id="rewind-confirmation-heading">Confirm campaign rewind</h3>
          <p><strong>{confirmation.checkpoint.label}</strong></p>
          <p>State {confirmation.checkpoint.stateVersion}</p>
          <p>The current future will remain preserved as an abandoned branch, but the active campaign will continue from this checkpoint.</p>
          <div>
            <button type="button" disabled={pending} onClick={() => rewind(confirmation.checkpoint)}>Confirm rewind</button>
            <button type="button" disabled={pending} onClick={() => setConfirmation(undefined)}>Cancel</button>
          </div>
        </div>
      ) : null}

      {confirmation?.kind === "FULL_PRIVATE_EXPORT" ? (
        <div className="confirmation-panel" role="dialog" aria-modal="true" aria-labelledby="export-confirmation-heading">
          <h3 id="export-confirmation-heading">Confirm spoiler-bearing export</h3>
          <p>This SaveSet contains hidden campaign truth, Director state, checkpoints, and branch history.</p>
          <div>
            <button type="button" disabled={pending} onClick={() => exportCampaign("FULL_PRIVATE")}>Export with spoilers</button>
            <button type="button" disabled={pending} onClick={() => setConfirmation(undefined)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
