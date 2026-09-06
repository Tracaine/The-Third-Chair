import type { PlayerView } from "@third-chair/contracts";
import { factsOfKind } from "../contracts";

interface ClueThreadsProps {
  readonly view: PlayerView;
}

export function ClueThreads({ view }: ClueThreadsProps) {
  const clues = factsOfKind(view.facts, "Clue");
  if (clues.length === 0 && view.openThreads.length === 0) return null;

  return (
    <section className="panel clue-threads" aria-labelledby="threads-heading">
      <div className="panel-heading">
        <div><span className="kicker">What we know</span><h2 id="threads-heading">Clues & open threads</h2></div>
        <span className="panel-mark panel-mark--feather" aria-hidden="true" />
      </div>
      <div className="clue-grid">
        <section>
          <h3>Known clues</h3>
          <ul>{clues.map((clue) => <li key={clue.id}>{clue.text}</li>)}</ul>
        </section>
        <section>
          <h3>Open threads</h3>
          <ul>
            {view.openThreads.map((thread) => (
              <li key={thread.id}><strong>{thread.name}</strong>{thread.facts.map((fact) => <span key={fact.id}>{fact.text}</span>)}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
