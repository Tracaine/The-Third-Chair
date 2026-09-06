import type { PlayerActorView } from "@third-chair/contracts";

interface CharacterCardProps {
  readonly actor: PlayerActorView;
}

export function CharacterCard({ actor }: CharacterCardProps) {
  const hpPercent = actor.maxHp === 0 ? 0 : Math.max(0, Math.min(100, (actor.currentHp / actor.maxHp) * 100));

  return (
    <article className={`character-card panel character-card--${actor.controller.toLocaleLowerCase()}`}>
      <header className="character-card__header">
        <div>
          <span className="kicker">{actor.controller === "BILL" ? "First chair" : "Second chair"}</span>
          <h2>{actor.name}</h2>
        </div>
        <span className="level">Level {actor.level}</span>
      </header>

      <dl className="stat-row">
        <div><dt>HP</dt><dd>{actor.currentHp}<span> / {actor.maxHp}</span></dd></div>
        <div><dt>AC</dt><dd>{actor.armorClass}</dd></div>
        <div><dt>Speed</dt><dd>{actor.speed}<span> ft</span></dd></div>
      </dl>
      <div className="hp-track" aria-label={`${actor.currentHp} of ${actor.maxHp} hit points`}>
        <span style={{ width: `${hpPercent}%` }} />
      </div>

      <div className="character-card__details">
        <section aria-label={`${actor.name} conditions`}>
          <h3>Conditions</h3>
          {actor.conditions.length > 0 ? (
            <ul className="chip-list">{actor.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
          ) : <p className="quiet">Clear</p>}
        </section>
        <section aria-label={`${actor.name} resources`}>
          <h3>Resources</h3>
          {actor.resources && actor.resources.length > 0 ? (
            <ul className="resource-list">
              {actor.resources.map((resource) => (
                <li key={resource.id}><span>{resource.name}</span><strong>{resource.current}/{resource.maximum}</strong></li>
              ))}
            </ul>
          ) : <p className="quiet">No limited resources visible</p>}
        </section>
      </div>
    </article>
  );
}
