import { useEffect, useState } from "react";
import { CharacterCard } from "./components/CharacterCard";
import { ClueThreads } from "./components/ClueThreads";
import { CombatPanel } from "./components/CombatPanel";
import { DecisionBanner } from "./components/DecisionBanner";
import { DiceTray } from "./components/DiceTray";
import { RecoveryStrip } from "./components/RecoveryStrip";
import { SceneHeader } from "./components/SceneHeader";
import { actorNameMap, type TableViewModel, type WidgetPreferences } from "./contracts";
import { explorationFixture } from "./fixtures/table-view";
import "./styles/tokens.css";
import "./styles/table.css";

interface AppProps {
  readonly view?: TableViewModel;
  readonly initialTheme?: WidgetPreferences["theme"];
}

export function App({ view = explorationFixture, initialTheme = "system" }: AppProps) {
  const [theme, setTheme] = useState<WidgetPreferences["theme"]>(initialTheme);
  const actorNames = actorNameMap(view.playerView);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);

  return (
    <div className="table-shell">
      <nav className="table-toolbar" aria-label="Table display">
        <div className="table-brand"><span aria-hidden="true">III</span><strong>Raven's Table</strong></div>
        <label>
          <span>Theme</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as WidgetPreferences["theme"])}>
            <option value="system">Host</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </nav>
      <main>
        <SceneHeader view={view.playerView} />
        <DecisionBanner decision={view.playerView.currentDecision} actorNames={actorNames} />
        <div className="table-grid">
          <div className="table-column table-column--story">
            <DiceTray checks={view.visibleChecks} />
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
