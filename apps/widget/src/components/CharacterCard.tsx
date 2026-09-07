import type { PlayerActorView } from "@third-chair/contracts";

interface CharacterCardProps {
  readonly actor: PlayerActorView;
}

const abilityLabels: Record<keyof PlayerActorView["abilities"], string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};

function title(value: string): string {
  return value.replace(/^test_spell_/, "").replaceAll("_", " ").replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function CharacterCard({ actor }: CharacterCardProps) {
  const hpPercent = actor.maxHp === 0 ? 0 : Math.max(0, Math.min(100, (actor.currentHp / actor.maxHp) * 100));
  const identity = [actor.ancestrySourceKey, actor.classSourceKey, actor.backgroundSourceKey].filter(Boolean).map((part) => title(part!)).join(" · ");
  const spellSlots = Object.entries(actor.spellSlots ?? {});

  return (
    <article className={`character-card panel character-card--${actor.controller.toLocaleLowerCase()}`}>
      <header className="character-card__header">
        <div>
          <span className="kicker">{actor.controller === "BILL" ? "First chair" : "Second chair"}</span>
          <h2>{actor.name}</h2>
          {identity && <p className="character-card__identity">{identity}</p>}
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

      <dl className="ability-grid" aria-label={`${actor.name} ability scores`}>
        {Object.entries(actor.abilities).map(([ability, score]) => (
          <div key={ability}><dt>{abilityLabels[ability as keyof PlayerActorView["abilities"]]}</dt><dd>{score}<span>{signed(Math.floor((score - 10) / 2))}</span></dd></div>
        ))}
      </dl>

      <div className="character-card__details">
        {actor.publicNotes.length > 0 && <p className="character-hook">{actor.publicNotes[0]}</p>}
        <div className="sheet-columns">
          <section aria-label={`${actor.name} skills`}>
            <h3>Skills</h3>
            {actor.skills && Object.keys(actor.skills).length > 0 ? (
              <ul className="sheet-list">{Object.entries(actor.skills).map(([name, value]) => <li key={name}><span>{title(name)}</span><strong>{signed(value)}</strong></li>)}</ul>
            ) : <p className="quiet">None listed</p>}
          </section>
          <section aria-label={`${actor.name} saving throws`}>
            <h3>Saving Throws</h3>
            {actor.saves && Object.keys(actor.saves).length > 0 ? (
              <ul className="sheet-list sheet-list--compact">{Object.entries(actor.saves).map(([name, value]) => <li key={name}><span>{abilityLabels[name as keyof PlayerActorView["abilities"]] ?? title(name)}</span><strong>{signed(value)}</strong></li>)}</ul>
            ) : <p className="quiet">None listed</p>}
          </section>
        </div>
        <section aria-label={`${actor.name} equipment`}>
          <h3>Equipment</h3>
          {actor.equipment && actor.equipment.length > 0 ? <p className="sheet-prose">{actor.equipment.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(" · ")}</p> : <p className="quiet">Traveling light</p>}
        </section>
        {(actor.spells?.length || spellSlots.length > 0) ? <section aria-label={`${actor.name} spellcasting`}>
          <h3>Spellcraft</h3>
          <p className="sheet-prose">{actor.spells?.map(title).join(" · ")}</p>
          {spellSlots.length > 0 && <ul className="slot-list">{spellSlots.map(([level, slots]) => <li key={level}>Level {level}<strong>{slots.current}/{slots.maximum} slots</strong></li>)}</ul>}
        </section> : null}
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
          ) : <p className="quiet">No limited resources</p>}
        </section>
      </div>
    </article>
  );
}
