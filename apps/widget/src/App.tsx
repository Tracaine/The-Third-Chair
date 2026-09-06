import { useEffect, useMemo, useState } from "react";
import { CharacterCard } from "./components/CharacterCard";
import { ClueThreads } from "./components/ClueThreads";
import { CombatPanel } from "./components/CombatPanel";
import { DecisionBanner } from "./components/DecisionBanner";
import { DiceTray } from "./components/DiceTray";
import { RecoveryStrip } from "./components/RecoveryStrip";
import { SceneHeader } from "./components/SceneHeader";
import { actorNameMap, type TableViewModel } from "./contracts";
import { explorationFixture } from "./fixtures/table-view";
import { refreshTable } from "./bridge/callTool";
import { applyHostPresentation } from "./bridge/host";
import { createDefaultBridge, type McpTableBridge } from "./bridge/mcp-app";
import { useToolResult } from "./bridge/useToolResult";
import "./styles/tokens.css";
import "./styles/table.css";

interface AppProps {
  readonly view?: TableViewModel;
  readonly bridge?: McpTableBridge;
}

export function App({ view: initialView = explorationFixture, bridge: providedBridge }: AppProps) {
  const bridge = useMemo(() => providedBridge ?? createDefaultBridge(), [providedBridge]);
  const state = useToolResult(initialView, bridge);
  const view = state.view;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const actorNames = actorNameMap(view.playerView);

  useEffect(applyHostPresentation, []);

  const refresh = async () => {
    if (!bridge || refreshing) return;
    setRefreshing(true);
    setRefreshError(false);
    try {
      const next = await refreshTable(view, (name, args) => bridge.callTool(name, args));
      if (next) state.accept(next);
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="table-shell" data-testid="table-shell" data-update-token={`${view.playerViewId}:${view.lastMutationId ?? "none"}`}>
      <nav className="table-toolbar" aria-label="Table display">
        <div className="table-brand"><span aria-hidden="true">III</span><strong>Raven's Table</strong></div>
        <button type="button" onClick={() => void refresh()} disabled={!bridge || refreshing}>
          {refreshing ? "Refreshing…" : "Refresh table"}
        </button>
        {refreshError ? <span role="status">Refresh unavailable</span> : null}
      </nav>
      <main>
        <SceneHeader view={view.playerView} />
        <DecisionBanner decision={view.playerView.currentDecision} actorNames={actorNames} />
        <div className="table-grid">
          <div className="table-column table-column--story">
            <DiceTray checks={view.visibleChecks} actorNames={actorNames} />
            <ClueThreads view={view.playerView} />
          </div>
          <div className="table-column table-column--party">
            <section className="party-stack" aria-label="Player characters">
              {view.playerView.actors.map((actor) => <CharacterCard key={actor.id} actor={actor} />)}
            </section>
            <CombatPanel view={view.playerView} actorNames={actorNames} />
          </div>
        </div>
      </main>
      <RecoveryStrip
        view={view.playerView}
        lastMutationId={view.lastMutationId}
        serverStatus={view.serverStatus}
      />
    </div>
  );
}
