import type { PlayerView } from "@third-chair/contracts";
import { factsOfKind } from "../contracts";

interface CombatPanelProps {
  readonly view: PlayerView;
  readonly actorNames: Readonly<Record<string, string>>;
}

function DetailList({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  if (items.length === 0) return null;
  return <section><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}

export function CombatPanel({ view, actorNames }: CombatPanelProps) {
  if (!view.combat) return null;
  const currentName = view.combat.currentActorId ? actorNames[view.combat.currentActorId] : undefined;
  const enemies = view.npcs.filter((npc) => npc.status.toLocaleLowerCase() === "hostile");

  return (
    <section className="panel combat-panel" role="region" aria-label="Combat">
      <div className="panel-heading">
        <div><span className="kicker">Initiative</span><h2>Combat</h2></div>
        <span className="round">Round {view.combat.round}</span>
      </div>
      {currentName ? <p className="current-actor">{currentName} is acting</p> : null}
      <ol className="initiative-track" aria-label="Initiative order">
        {view.combat.initiativeOrder.map((id, index) => (
          <li key={id} className={id === view.combat?.currentActorId ? "is-current" : ""}>
            <span>{index + 1}</span>{actorNames[id]}
          </li>
        ))}
      </ol>
      <div className="combat-grid">
        <DetailList title="Visible enemies" items={enemies.map((enemy) => enemy.name)} />
        <DetailList title="Terrain" items={factsOfKind(view.combat.facts, "Terrain").map((fact) => fact.text)} />
        <DetailList title="Hazards" items={factsOfKind(view.combat.facts, "Hazard").map((fact) => fact.text)} />
        <DetailList title="Interactables" items={factsOfKind(view.combat.facts, "Interactable").map((fact) => fact.text)} />
      </div>
    </section>
  );
}
