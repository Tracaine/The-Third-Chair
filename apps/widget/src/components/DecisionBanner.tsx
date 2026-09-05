import type { PlayerDecisionView } from "@third-chair/contracts";

interface DecisionBannerProps {
  readonly decision: PlayerDecisionView;
  readonly actorNames: Readonly<Record<string, string>>;
}

const ownerLabels: Record<PlayerDecisionView["owner"], string> = {
  BILL: "Bill decides",
  RAVEN: "Raven decides",
  BOTH: "Bill and Raven decide",
  DIRECTOR: "The world moves",
};

export function DecisionBanner({ decision, actorNames }: DecisionBannerProps) {
  const eligibleNames = decision.eligibleActorIds?.map((id) => actorNames[id]).filter(Boolean) ?? [];
  return (
    <section className={`decision-banner decision-banner--${decision.owner.toLocaleLowerCase()}`} aria-labelledby="decision-heading">
      <div className="decision-banner__owner">
        <span className="kicker">Next at the table</span>
        <h2 id="decision-heading">{ownerLabels[decision.owner]}</h2>
      </div>
      <div className="decision-banner__prompt">
        <p>{decision.requiredInput ?? decision.situation}</p>
        <span>{decision.mode.toLocaleLowerCase()}</span>
        {eligibleNames.length > 0 ? <span>{eligibleNames.join(" & ")}</span> : null}
      </div>
    </section>
  );
}
