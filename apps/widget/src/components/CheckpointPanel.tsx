import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import {
  CreateCheckpointOutputSchema,
  ExportCampaignOutputSchema,
  type CheckpointSummary,
  type ExportCampaignOutput,
  type SaveSetMode,
} from "@third-chair/contracts";
import type { DownloadableResourceLink, McpTableBridge } from "../bridge/mcp-app";
import type { TableViewModel } from "../contracts";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface CheckpointPanelProps {
  readonly view: TableViewModel;
  readonly bridge?: McpTableBridge | undefined;
  readonly refresh: () => Promise<void>;
  readonly newRequestId?: (() => string) | undefined;
}

type PendingConfirmation =
  | { readonly kind: "REWIND"; readonly checkpoint: CheckpointSummary; readonly returnFocus: HTMLElement }
  | { readonly kind: "FULL_PRIVATE_EXPORT"; readonly returnFocus: HTMLElement };

interface AvailableArchive extends ExportCampaignOutput {
  readonly mode: SaveSetMode;
  readonly resource: DownloadableResourceLink;
}

function downloadableResource(value: unknown, output: ExportCampaignOutput): DownloadableResourceLink | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "resource_link"
    || typeof candidate.name !== "string"
    || candidate.name.length === 0
    || candidate.uri !== output.uri
    || candidate.mimeType !== output.mimeType
    || candidate.size !== output.sizeBytes) return undefined;
  if (candidate.description !== undefined && typeof candidate.description !== "string") return undefined;
  return {
    type: "resource_link",
    name: candidate.name,
    uri: output.uri,
    ...(candidate.description === undefined ? {} : { description: candidate.description }),
    mimeType: output.mimeType,
    size: output.sizeBytes,
  };
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hour}:${minute} UTC`;
}

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
  const [closeConfirmationWhenSettled, setCloseConfirmationWhenSettled] = useState(false);
  const [archives, setArchives] = useState<readonly AvailableArchive[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setCheckpoints([]);
    setArchives([]);
    setCloseConfirmationWhenSettled(false);
    setConfirmation(undefined);
  }, [view.playerView.campaignId]);

  useEffect(() => {
    if (pending || !closeConfirmationWhenSettled) return;
    setCloseConfirmationWhenSettled(false);
    setConfirmation(undefined);
  }, [pending, closeConfirmationWhenSettled]);

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
      setCloseConfirmationWhenSettled(true);
    });
  };

  const exportCampaign = (mode: SaveSetMode) => {
    void execute(async () => {
      const result = await call("export_campaign", {
        campaignId: view.playerView.campaignId,
        expectedStateVersion: view.playerView.stateVersion,
        requestId: newRequestId(),
        mode,
        confirmedSpoilers: mode === "FULL_PRIVATE",
      });
      const output = ExportCampaignOutputSchema.parse(result.structuredContent);
      const resource = result.content
        ?.map((item) => downloadableResource(item, output))
        .find((item): item is DownloadableResourceLink => item !== undefined);
      if (!resource) throw new Error("EXPORT_RESOURCE_UNAVAILABLE");
      setArchives((current) => [
        ...current.filter(({ exportId }) => exportId !== output.exportId),
        { ...output, mode, resource },
      ]);
      if (mode === "FULL_PRIVATE") setCloseConfirmationWhenSettled(true);
    });
  };

  const downloadArchive = (archive: AvailableArchive) => {
    if (!bridge || pending) return;
    setPending(true);
    setError(false);
    void bridge.downloadFile(archive.resource)
      .then((result) => {
        if (result.isError) throw new Error("EXPORT_DOWNLOAD_FAILED");
      })
      .catch(() => setError(true))
      .finally(() => setPending(false));
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
                onClick={(event: MouseEvent<HTMLButtonElement>) => setConfirmation({
                  kind: "REWIND",
                  checkpoint,
                  returnFocus: event.currentTarget,
                })}
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
          onClick={(event: MouseEvent<HTMLButtonElement>) => setConfirmation({
            kind: "FULL_PRIVATE_EXPORT",
            returnFocus: event.currentTarget,
          })}
        >Export full-private SaveSet</button>
      </div>

      {archives.length > 0 ? (
        <section className="available-archives" aria-labelledby="available-archives-heading">
          <h3 id="available-archives-heading">Available archives</h3>
          <ul>
            {archives.map((archive) => (
              <li key={archive.exportId}>
                <button
                  type="button"
                  disabled={!bridge || pending}
                  aria-label={`Download ${archive.mode === "PLAYER_SAFE" ? "player-safe" : "full-private"} SaveSet`}
                  onClick={() => downloadArchive(archive)}
                >{archive.resource.name}</button>
                <small>{archive.sizeBytes} bytes · expires {formatExpiry(archive.expiresAt)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p role="alert">Campaign control unavailable. Refresh the table before trying again.</p> : null}

      {confirmation?.kind === "REWIND" ? (
        <ConfirmationDialog
          labelledBy="rewind-confirmation-heading"
          onClose={() => { if (!pending) setConfirmation(undefined); }}
          returnFocus={confirmation.returnFocus}
        >
          <h3 id="rewind-confirmation-heading">Confirm campaign rewind</h3>
          <p><strong>{confirmation.checkpoint.label}</strong></p>
          <p>State {confirmation.checkpoint.stateVersion}</p>
          <p>The current future will remain preserved as an abandoned branch, but the active campaign will continue from this checkpoint.</p>
          <div>
            <button type="button" disabled={pending} onClick={() => rewind(confirmation.checkpoint)}>Confirm rewind</button>
            <button type="button" disabled={pending} onClick={() => setConfirmation(undefined)}>Cancel</button>
          </div>
        </ConfirmationDialog>
      ) : null}

      {confirmation?.kind === "FULL_PRIVATE_EXPORT" ? (
        <ConfirmationDialog
          labelledBy="export-confirmation-heading"
          onClose={() => { if (!pending) setConfirmation(undefined); }}
          returnFocus={confirmation.returnFocus}
        >
          <h3 id="export-confirmation-heading">Confirm spoiler-bearing export</h3>
          <p>This SaveSet contains hidden campaign truth, Director state, checkpoints, and branch history.</p>
          <div>
            <button type="button" disabled={pending} onClick={() => exportCampaign("FULL_PRIVATE")}>Export with spoilers</button>
            <button type="button" disabled={pending} onClick={() => setConfirmation(undefined)}>Cancel</button>
          </div>
        </ConfirmationDialog>
      ) : null}
    </section>
  );
}
