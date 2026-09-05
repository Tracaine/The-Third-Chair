import type { PlayerView } from "@third-chair/contracts";
import { factsOfKind } from "../contracts";

interface SceneHeaderProps {
  readonly view: PlayerView;
}

export function SceneHeader({ view }: SceneHeaderProps) {
  const objective = factsOfKind(view.location.facts, "Objective")[0];
  const pressure = factsOfKind(view.location.facts, "Pressure")[0];
  const date = `${view.worldDate.day} ${view.worldDate.month}, ${view.worldDate.yearDr} DR`;

  return (
    <header className="scene-header panel panel--scene">
      <div className="scene-header__eyebrow">
        <span>{date}</span>
        <span aria-hidden="true">◆</span>
        <span>{view.location.status}</span>
      </div>
      <h1>{view.location.name}</h1>
      <div className="scene-header__brief">
        {objective ? (
          <p><span className="label">Objective</span>{objective.text}</p>
        ) : null}
        {pressure ? (
          <p className="scene-header__pressure"><span className="label">Pressure</span>{pressure.text}</p>
        ) : null}
      </div>
    </header>
  );
}
