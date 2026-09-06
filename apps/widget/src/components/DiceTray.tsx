import type { VisibleCheck } from "../contracts";

interface DiceTrayProps {
  readonly checks: readonly VisibleCheck[];
  readonly actorNames: Readonly<Record<string, string>>;
}

const tierLabel: Record<VisibleCheck["tier"], string> = {
  CRITICAL_FAILURE: "Critical failure",
  FAILURE: "Failure",
  SUCCESS: "Success",
  CRITICAL_SUCCESS: "Critical success",
};

export function DiceTray({ checks, actorNames }: DiceTrayProps) {
  const recentChecks = checks.filter((check) => check.visibility === "PUBLIC").slice(-6).reverse();
  if (recentChecks.length === 0) return null;

  return (
    <section className="panel dice-tray" aria-labelledby="dice-heading">
      <div className="panel-heading">
        <div><span className="kicker">Open record</span><h2 id="dice-heading">Dice tray</h2></div>
        <span className="panel-mark" aria-hidden="true">◇</span>
      </div>
      <ol className="check-list">
        {recentChecks.map((check) => (
          <li key={check.id} className="check-card">
            <div className="check-card__heading">
              <div><span className="check-card__actor">{actorNames[check.actorId] ?? "Visible actor"} · {check.checkKind}</span><strong>{check.keptDie} {check.modifier >= 0 ? "+" : "−"} {Math.abs(check.modifier)} = {check.total}</strong></div>
              <span className={`tier tier--${check.tier.toLocaleLowerCase()}`}>{tierLabel[check.tier]}</span>
            </div>
            <div className="check-card__math">
              <span>Natural {check.naturalDice.join(" / ")}</span>
              <span>Target {check.target}</span>
              <span>{check.advantage === "NORMAL" ? "Straight roll" : check.advantage.toLocaleLowerCase()}</span>
            </div>
            <div className="stakes">
              <p><span>On success:</span> {check.successStakes}</p>
              <p><span>On failure:</span> {check.failureStakes}</p>
            </div>
            {check.consequence ? <p className="consequence"><span>Consequence</span>{check.consequence}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
