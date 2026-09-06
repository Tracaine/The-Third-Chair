---
name: third-chair-rules
description: Use when asking an SRD 5.1 rules question or reviewing a Third Chair table ruling without advancing campaign state.
---

# Third Chair Rules

Give a sourced ruling without moving the game. This skill is a read-only rules lane: it calls `answer_rules` and never calls `advance_game`.

## Ruling recipe

1. Call `answer_rules` with the exact question. Include `campaignId` when accepted house rules may apply and `actorId` only when the ruling depends on that visible actor.
2. Lead with the practical ruling in one or two sentences.
3. Separate the basis:
   - **RAW (SRD 5.1):** summarize only claims supported by returned rules citations.
   - **Accepted house rule:** label each returned overlay explicitly and explain how it changes RAW.
4. Place concise returned citations beside the claims they support. Do not invent a page, section, quotation, or source.
5. If the SRD or accepted overlay does not answer the question, say so and identify the narrow adjudication the table must make. Do not turn uncertainty into false precision.

Forgotten Realms 3e material is lore, not mechanics for this SRD 5.1 game. Do not import, convert, or apply its classes, feats, spells, or subsystems as rules. A separate, explicitly accepted house rule would need to exist before it can affect a campaign ruling.

If a message also asks to resolve a fictional action, finish the read-only ruling and route the action to `third-chair-play`; do not mutate state from this skill.

## Quick reference

| Returned basis | Presentation |
|---|---|
| SRD citation | Label RAW and cite the supported claim |
| Accepted overlay | Label house rule and contrast with RAW |
| No governing text | State uncertainty; identify adjudication |
| 3e mechanics | Treat as lore, not usable rules |

## Common mistakes

- Advancing an action because it accompanies a rules question.
- Presenting an accepted table rule as RAW.
- Citing lore material as SRD 5.1 mechanics.
- Filling a source gap from general model memory.
