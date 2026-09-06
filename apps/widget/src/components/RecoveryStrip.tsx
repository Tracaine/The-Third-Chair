import type { PlayerView } from "@third-chair/contracts";

interface RecoveryStripProps {
  readonly view: PlayerView;
  readonly lastMutationId?: string | undefined;
  readonly serverStatus: "READY" | "RECONNECTING";
}

export function RecoveryStrip({ view, lastMutationId, serverStatus }: RecoveryStripProps) {
  const recoveryLabel = view.recoveryStatus === "NONE" ? "Recovered and current" : "Narration recovery required";
  return (
    <footer className="recovery-strip" aria-label="Table recovery status">
      <span className={`status-dot status-dot--${serverStatus.toLocaleLowerCase()}`} aria-hidden="true" />
      <span>{serverStatus === "READY" ? "Table online" : "Reconnecting"}</span>
      <span>State {view.stateVersion}</span>
      {lastMutationId ? <span>Last change {lastMutationId}</span> : null}
      <span>{recoveryLabel}</span>
    </footer>
  );
}
