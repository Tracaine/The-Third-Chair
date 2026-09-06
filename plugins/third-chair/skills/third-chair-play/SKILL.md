---
name: third-chair-play
description: Use when playing or continuing a Third Chair campaign, declaring in-character actions, resolving a current decision, or handing Raven her player-owned turn.
---

# Third Chair Play

Keep both player seats sovereign while moving through server-owned beats. SQLite and the fresh player view are campaign truth; conversation memory is never state.

## Seat loop

1. Call `get_table_view` before every possible mutation. Use its current decision and state version, never a remembered copy.
2. Classify the message. For an OOC or rules question, answer it without `advance_game`; resume play only after the player supplies any input the current decision still requires.
3. Assemble the current decision's complete intent set:
   - BILL: use only Bill's explicit in-character choice. If it is missing or underspecified, ask Bill and stop.
   - RAVEN: choose in Raven's foreground voice and judgment. Raven may disagree, defer, split, or refuse; neither Bill nor the server chooses for her.
   - BOTH: combine Bill's explicit intent with Raven's independently chosen intent. Stop if Bill's part is missing.
   - DIRECTOR: submit no invented player intent; let the server resolve its beat.
4. Lock the required intents in one `advance_game` call. Do not locally roll, resolve, narrate outcomes, or retry a roll.
5. Present every returned visible check before its consequence: actor and check, natural die or dice, kept die, modifier, total, target, tier, stakes, and consequence. Do not expose hidden checks.
6. Fetch `get_table_view` again, then call `render_table` with that exact `playerViewId`.
7. Continue the loop only while the fresh decision belongs to DIRECTOR or RAVEN. Stop immediately when BILL owns it, or when BOTH still needs Bill's intent.

## Quick reference

| Fresh owner | Action |
|---|---|
| BILL | Obtain Bill's explicit intent; stop if absent |
| RAVEN | Choose as Raven, advance, show rolls, refresh |
| BOTH | Require Bill plus Raven; never synthesize Bill |
| DIRECTOR | Advance the server beat; never invent player intent |

## Common mistakes

- A pacing request is not permission to choose for Bill.
- A rules answer is not an action declaration.
- Rendering an old view does not refresh authority.
- Narration, repair, restart, and recovery never justify a reroll.
