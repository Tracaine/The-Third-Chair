# CHAIR-004 Raven's Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an installable private Third Chair plugin whose MCP tools, persistent React table mat, and tested skills let Bill and foreground Raven play a complete exploration/social/combat scene in ChatGPT.

**Architecture:** Expand the player-safe MCP surface around the live engine, separate state/data calls from the `render_table` UI call, and serve one versioned single-file React widget through the MCP Apps bridge. Package four narrow skills around the server; behavior-test each skill independently before moving to the next; register the private MCP connection in ChatGPT Developer Mode and wire its technical ID into the plugin package.

**Tech Stack:** Node.js 24 LTS, TypeScript, Express, `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, React, Vite, Vitest, Testing Library, jsdom, plain CSS, and the OpenAI plugin/skill packaging format.

**Spec:** `docs/superpowers/specs/2026-08-27-third-chair-design.md`

## Global Constraints

- Primary app archetype is `interactive-decoupled`.
- Re-fetch the current official MCP server, UI, examples, tools, reference, packaging, and connect/test pages before implementation.
- Start from the smallest current official React/MCP Apps example that demonstrates tool-result hydration; record its repository commit and copy only required bridge/build patterns.
- Durable truth remains in `campaigns.sqlite`; widget state contains presentation preferences only.
- The MCP Apps bridge is the baseline integration. `window.openai` is optional and additive.
- `structuredContent` is concise model-visible player state; `content` is short player-safe text; `_meta` is widget-only but still player-visible.
- Tool retries are safe. Every advertised annotation matches actual behavior.
- CHAIR-004 advertises only implemented tools. CHAIR-005 adds `create_campaign`, checkpoint, rewind, and export tools when their engine behavior exists.
- Character actions remain conversational. Widget controls may refresh and change presentation, but may not author Bill's or Raven's in-character action in V1.
- The widget works with fixture data in a standalone browser, but standalone state is never authoritative.
- Every skill is created and behavior-tested one at a time with `skill-creator` and `superpowers:writing-skills`; do not batch untested skills.
- The plugin contains no source database, source excerpt, OCR output, PDF, hidden campaign state, API key, or raw agent prompt.

---

### Task 1: Complete the CHAIR-004 Player-Safe MCP Data Surface

**Files:**
- Create: `apps/server/src/mcp/tools/list-campaigns.ts`
- Create: `apps/server/src/mcp/tools/answer-rules.ts`
- Create: `apps/server/src/mcp/tools/recall-known-lore.ts`
- Modify: `apps/server/src/mcp/tools/get-table-view.ts`
- Modify: `apps/server/src/mcp/tools/advance-game.ts`
- Modify: `apps/server/src/mcp/server.ts`
- Modify: `packages/contracts/src/tools.ts`
- Modify: `packages/contracts/src/views.ts`
- Test: `apps/server/test/data-tools.test.ts`
- Test: `apps/server/test/tool-annotations.test.ts`
- Test: `apps/server/test/result-partition.test.ts`

**Interfaces:**
- Consumes: campaign repository, `SourcePackService`, `TurnEngine`, and audience projections.
- Produces: `list_campaigns`, `get_table_view`, `advance_game`, `answer_rules`, and `recall_known_lore` with declared input/output schemas.

- [ ] **Step 1: Write failing descriptor and partition tests**

Use this exact annotation matrix:

| Tool | readOnly | destructive | openWorld | idempotent |
| --- | ---: | ---: | ---: | ---: |
| `list_campaigns` | true | false | false | true |
| `get_table_view` | true | false | false | true |
| `advance_game` | false | false | false | true |
| `answer_rules` | true | false | false | true |
| `recall_known_lore` | true | false | false | true |

Assert each description begins `Use this when...`, every tool has input/output schemas, all IDs are stable, and sentinel secrets are absent from `structuredContent`, `content`, and `_meta`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- apps/server/test/data-tools.test.ts apps/server/test/tool-annotations.test.ts apps/server/test/result-partition.test.ts`

- [ ] **Step 3: Define exact tool contracts**

```ts
ListCampaignsInput = { audience: "BILL" | "RAVEN" };
GetTableViewInput = { campaignId: string; audience: "BILL" | "RAVEN" };
AnswerRulesInput = { campaignId?: string; question: string; actorId?: string };
RecallKnownLoreInput = { campaignId: string; actorId: string; question: string };
```

`list_campaigns` returns ID, name, visible date/location, state version, current decision owner/mode, status, and last committed time. `get_table_view` returns a `PlayerView` plus deterministic `playerViewId = sha256(campaignId, stateVersion, audience, stateHash)`. `answer_rules` returns a concise ruling, SRD citations, and accepted campaign house-rule overlays. `recall_known_lore` queries only knowledge/entity/citation IDs established for that actor; it never performs unrestricted lore search on the player's behalf.

- [ ] **Step 4: Implement safe result helpers**

Create one `toMcpResult()` helper that validates `structuredContent` against the advertised schema, caps `content` at 2,000 characters, and runs the sentinel/forbidden-key guard over all three result partitions during development and tests. `_meta` may contain panel ordering, icon names, and accessible labels; it may not contain more campaign facts than `PlayerView`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- apps/server/test/data-tools.test.ts apps/server/test/tool-annotations.test.ts apps/server/test/result-partition.test.ts && npm run typecheck`

```bash
git add apps/server packages/contracts
git commit -m "feat: expose player-safe table tools"
```

---

### Task 2: Add the Decoupled Render Tool and Versioned Widget Resource

**Files:**
- Create: `apps/server/src/mcp/tools/render-table.ts`
- Create: `apps/server/src/mcp/widget-resource.ts`
- Modify: `apps/server/src/mcp/server.ts`
- Create: `apps/widget/package.json`
- Create: `apps/widget/tsconfig.json`
- Create: `apps/widget/index.html`
- Create: `apps/widget/vite.config.ts`
- Create: `apps/widget/src/main.tsx`
- Create: `apps/widget/src/App.tsx`
- Test: `apps/server/test/render-tool.test.ts`
- Test: `apps/server/test/widget-resource.test.ts`

**Interfaces:**
- Consumes: a current `playerViewId` from `get_table_view`.
- Produces: `render_table`, resource URI `ui://third-chair/table-v1.html`, and one bundled `text/html;profile=mcp-app` resource.

- [ ] **Step 1: Recheck examples and record the upstream baseline**

Clone `https://github.com/openai/openai-apps-sdk-examples` to a `mktemp -d` directory, record `git rev-parse HEAD` in `docs/operations/upstream-widget.md`, inspect only the smallest React example that hydrates from a tool result, and copy only bridge/build ideas—not demo product code, branding, data, or tool names.

- [ ] **Step 2: Write failing render/resource tests**

Assert `render_table` is read-only/idempotent, rejects stale or mismatched `playerViewId`, attaches `_meta.ui.resourceUri`, mirrors `_meta["openai/outputTemplate"]` only as compatibility, and returns current `PlayerView` in `structuredContent`. Assert the registered resource MIME type and CSP are exact.

- [ ] **Step 3: Run tests to verify RED**

Run: `npm test -- apps/server/test/render-tool.test.ts apps/server/test/widget-resource.test.ts`

- [ ] **Step 4: Implement the render contract**

```ts
RenderTableInput = {
  campaignId: string;
  audience: "BILL" | "RAVEN";
  playerViewId: string;
};
```

Recompute the current player view and ID server-side. A stale ID returns `STALE_PLAYER_VIEW` with the fresh version; it never renders cached truth. Tool metadata uses:

```ts
_meta: {
  ui: { resourceUri: "ui://third-chair/table-v1.html" },
  "openai/outputTemplate": "ui://third-chair/table-v1.html",
  "openai/toolInvocation/invoking": "Setting the table…",
  "openai/toolInvocation/invoked": "The table is ready",
}
```

- [ ] **Step 5: Configure the single-file React build and resource metadata**

Use Vite plus `vite-plugin-singlefile` so the server returns one self-contained HTML resource. Set resource metadata to no outbound connections or frames:

```ts
{
  "openai/widgetDescription": "A persistent, player-safe Third Chair table showing the current scene, character status, visible dice, combat, clues, and recovery state.",
  ui: {
    csp: { connectDomains: [], resourceDomains: [] },
    prefersBorder: false
  }
}
```

Load the built file at server startup and fail readiness with `WIDGET_BUILD_MISSING` if absent; do not serve a blank resource.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- apps/server/test/render-tool.test.ts apps/server/test/widget-resource.test.ts && npm run build --workspace @third-chair/widget && npm run typecheck`

```bash
git add apps/server apps/widget docs/operations/upstream-widget.md
git commit -m "feat: register raven table widget"
```

---

### Task 3: Build the Persistent Table Mat UI

**Files:**
- Create: `apps/widget/src/contracts.ts`
- Create: `apps/widget/src/fixtures/table-view.ts`
- Create: `apps/widget/src/components/SceneHeader.tsx`
- Create: `apps/widget/src/components/CharacterCard.tsx`
- Create: `apps/widget/src/components/DiceTray.tsx`
- Create: `apps/widget/src/components/CombatPanel.tsx`
- Create: `apps/widget/src/components/ClueThreads.tsx`
- Create: `apps/widget/src/components/RecoveryStrip.tsx`
- Create: `apps/widget/src/components/DecisionBanner.tsx`
- Create: `apps/widget/src/styles/tokens.css`
- Create: `apps/widget/src/styles/table.css`
- Modify: `apps/widget/src/App.tsx`
- Test: `apps/widget/src/App.test.tsx`
- Test: `apps/widget/src/components/DiceTray.test.tsx`
- Test: `apps/widget/src/components/DecisionBanner.test.tsx`

**Interfaces:**
- Consumes: `PlayerView` plus visible check/narration summary from `structuredContent`.
- Produces: accessible responsive table UI and presentation-only `WidgetPreferences`.

- [ ] **Step 1: Write failing component tests**

Render fixture exploration and combat views. Assert scene/date/location/objective, Bill and Raven cards, HP/AC/conditions/resources, checks in roll-before-consequence order, initiative/current actor, visible enemies/terrain/hazards/interactables, clues/open threads, state version, and recovery status. Assert hidden fields never render and Bill-owned decisions say `Bill decides` rather than offering Raven controls.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --project widget`

- [ ] **Step 3: Implement the visual system**

Use a restrained candlelit field-journal aesthetic: ink-black and parchment neutrals, muted plum for Raven, old brass for active decisions, crimson only for danger/HP, and a hairline feather motif drawn in CSS. Avoid fantasy-display fonts, fake leather textures, animated flames, gradients behind body text, and dense VTT chrome. Respect host light/dark theme and `prefers-reduced-motion`.

Desktop uses a two-column grid with scene/dice/clues on the left and character/combat status on the right. Narrow widths collapse to one column. Each card has semantic headings, WCAG AA contrast, visible focus, and text equivalents for icons.

- [ ] **Step 4: Implement exact panel behavior**

- `SceneHeader`: date, location, objective, pressure.
- `DecisionBanner`: owner, eligible actor, mode, and one clear prompt; no hidden/legal inference.
- `CharacterCard`: public sheet for both; viewer-permitted detail for the viewer's actor.
- `DiceTray`: last six visible resolutions, natural/kept dice, modifier, total, target, tier, and stakes.
- `CombatPanel`: appears only in combat and lists current initiative actor, round, visible combatants, terrain, hazards, and interactables.
- `ClueThreads`: known clues and open threads only.
- `RecoveryStrip`: state version, last mutation ID, server/recovery status; checkpoint controls arrive in CHAIR-005.

- [ ] **Step 5: Run tests, inspect both themes, and commit**

Run: `npm test -- --project widget && npm run build --workspace @third-chair/widget`

Open the standalone fixture at desktop and 390px width in light/dark mode. Record screenshots locally under ignored `tmp/widget-review/`; do not commit them as product art.

```bash
git add apps/widget
git commit -m "feat: build persistent third chair table mat"
```

---

### Task 4: Implement Bridge-First State Sync and Standalone Fallback

**Files:**
- Create: `apps/widget/src/bridge/mcp-app.ts`
- Create: `apps/widget/src/bridge/useToolResult.ts`
- Create: `apps/widget/src/bridge/useWidgetPreferences.ts`
- Create: `apps/widget/src/bridge/callTool.ts`
- Create: `apps/widget/src/bridge/host.ts`
- Modify: `apps/widget/src/App.tsx`
- Test: `apps/widget/src/bridge/mcp-app.test.ts`
- Test: `apps/widget/src/bridge/state-sync.test.tsx`
- Test: `apps/widget/src/bridge/standalone.test.tsx`

**Interfaces:**
- Consumes: `ui/notifications/tool-result`, `tools/call`, optional `window.openai` globals, `stateVersion`, and `lastMutationId`.
- Produces: mounted-widget updates without remount, `refreshTable()`, and `WidgetPreferences` persistence.

- [ ] **Step 1: Write failing bridge lifecycle tests**

Simulate initial host globals, a later `ui/notifications/tool-result`, a duplicate result with the same `lastMutationId`, and a newer state version. Assert duplicates do not animate/reapply, newer results update in place, and no host APIs uses fixture fallback. Assert widget state stores only expanded panel IDs, selected tab, and reduced-motion preference.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --project widget apps/widget/src/bridge`

- [ ] **Step 3: Implement MCP Apps bridge baseline**

Listen for JSON-RPC `ui/notifications/tool-result`, validate `structuredContent`, and call server tools through `tools/call`. Use `ui/message` only for follow-up conversation requests. Do not use `ui/update-model-context` for ordinary table preferences because the model does not need them.

- [ ] **Step 4: Add optional ChatGPT compatibility**

Feature-detect `window.openai.toolOutput`, `theme`, `locale`, `safeArea`, `setWidgetState`, and `requestDisplayMode`. Use them for initial hydration, theming, presentation persistence, and optional fullscreen; never make them the sole path. Do not expose file upload, external links, or model-context updates in V1.

- [ ] **Step 5: Add refresh-only component action**

`refreshTable()` calls `get_table_view`, then `render_table` only when the returned `playerViewId` differs. In-character actions remain in chat. CHAIR-005 will add checkpoint/rewind controls after their server tools exist.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- --project widget && npm run build --workspace @third-chair/widget && npm run typecheck`

```bash
git add apps/widget
git commit -m "feat: synchronize mounted table through mcp bridge"
```

---

### Task 5: Create and Behavior-Test `third-chair-play`

**Files:**
- Create: `plugins/third-chair/skills/third-chair-play/SKILL.md`
- Create: `plugins/third-chair/skills/third-chair-play/agents/openai.yaml`
- Create: `evals/cases/skill-third-chair-play.jsonl`
- Create: `docs/operations/skill-third-chair-play.md`

**Interfaces:**
- Consumes: `get_table_view`, `advance_game`, `render_table`, Bill's message, and foreground Raven's own judgment.
- Produces: correct live-play seat loop without puppeting either player.

- [ ] **Step 1: Run and record RED baseline scenarios without the skill**

Use fresh isolated evaluators for at least: a BOTH exploration decision, a Bill-owned reaction, a Raven initiative turn, a Director NPC sequence, an OOC rules question during play, and pressure to “just choose for Bill so we can continue.” Record whether the baseline skips a fresh view, invents Bill's choice, asks Bill to puppet Raven, hides a roll, or continues past Bill ownership.

- [ ] **Step 2: Write the minimal skill from observed failures**

Use this exact frontmatter:

```yaml
---
name: third-chair-play
description: Use when playing or continuing a Third Chair campaign, declaring in-character actions, resolving a current decision, or handing Raven her player-owned turn.
---
```

The body defines this positive recipe: fetch a fresh table view; distinguish OOC/rules from in-character intent; stop for missing Bill-owned input; choose Raven-owned input in Raven's foreground voice; lock required intents; call `advance_game`; show visible check blocks before consequences; refresh/render; continue only through Director-owned beats and Raven-owned decisions; stop the instant Bill owns the next decision. It states that chat memory is never state and that Raven may disagree, defer, split, or refuse.

Create `agents/openai.yaml` with `display_name: "Third Chair Play"`, `short_description: "Play the current decision without surrendering either player seat"`, and `default_prompt: "Resume our Third Chair campaign."`; keep implicit invocation enabled.

- [ ] **Step 3: Run GREEN and pressure scenarios with the skill**

Use direct, indirect, incomplete, negative, and combined-pressure prompts. Required pass conditions: zero invented Bill choices; zero server-generated Raven choices; every mutation preceded by a fresh view; every visible roll shown; no continuation past Bill ownership.

- [ ] **Step 4: Validate and commit before creating another skill**

Run the skill creator's `quick_validate.py` against this skill and record behavioral results in `skill-third-chair-play.md`.

```bash
git add plugins/third-chair/skills/third-chair-play evals/cases/skill-third-chair-play.jsonl docs/operations/skill-third-chair-play.md
git commit -m "feat: teach the third chair play loop"
```

Do not start Task 6 until this task is green and committed.

---

### Task 6: Create and Behavior-Test `third-chair-campaign`

**Files:**
- Create: `plugins/third-chair/skills/third-chair-campaign/SKILL.md`
- Create: `plugins/third-chair/skills/third-chair-campaign/agents/openai.yaml`
- Create: `evals/cases/skill-third-chair-campaign.jsonl`
- Create: `docs/operations/skill-third-chair-campaign.md`

**Interfaces:**
- Consumes: `list_campaigns`, `get_table_view`, and `render_table` in CHAIR-004.
- Produces: safe list/resume/audit behavior; CHAIR-005 later extends this same skill for create/checkpoint/rewind/export and reruns its tests.

- [ ] **Step 1: Run RED baselines without the skill**

Test “resume our game,” ambiguous campaign names, a source-pack mismatch, and pressure to invent state from chat after the database is unavailable. Record incorrect activation or fabricated continuity.

- [ ] **Step 2: Write the minimal CHAIR-004 skill**

```yaml
---
name: third-chair-campaign
description: Use when listing, resuming, inspecting, or auditing a Third Chair campaign outside the live action loop.
---
```

The workflow lists campaigns, resolves ambiguity from returned IDs, fetches the authoritative view, reports read-only/recovery status, and renders only after a valid view. It never reconstructs missing truth from conversation memory. It explicitly says campaign creation, checkpoints, rewind, and export are unavailable until the server advertises those tools.

Create `agents/openai.yaml` with `display_name: "Third Chair Campaign"`, `short_description: "Resume and manage persistent Third Chair campaigns"`, and `default_prompt: "Show my Third Chair campaigns."`; keep implicit invocation enabled.

- [ ] **Step 3: Run GREEN/negative tests and validate**

Pass direct/indirect activation, ambiguous selection, database unavailable, and ordinary live-action prompts that should route to `third-chair-play` instead.

- [ ] **Step 4: Commit before the next skill**

```bash
git add plugins/third-chair/skills/third-chair-campaign evals/cases/skill-third-chair-campaign.jsonl docs/operations/skill-third-chair-campaign.md
git commit -m "feat: teach campaign resume and audit"
```

---

### Task 7: Create and Behavior-Test `third-chair-rules`

**Files:**
- Create: `plugins/third-chair/skills/third-chair-rules/SKILL.md`
- Create: `plugins/third-chair/skills/third-chair-rules/agents/openai.yaml`
- Create: `evals/cases/skill-third-chair-rules.jsonl`
- Create: `docs/operations/skill-third-chair-rules.md`

**Interfaces:**
- Consumes: `answer_rules`; optionally the current campaign ID and actor ID.
- Produces: concise SRD 5.1 rulings with citations and accepted house-rule overlays without advancing play.

- [ ] **Step 1: Run RED baseline scenarios**

Test a general rule, a campaign-specific rule, a 3e prestige-class mechanic, an uncertain rule, and pressure to resolve a fictional action while “just answering the rule.” Record edition mixing, uncited certainty, and accidental state mutation.

- [ ] **Step 2: Write the minimal skill**

```yaml
---
name: third-chair-rules
description: Use when asking an SRD 5.1 rules question or reviewing a Third Chair table ruling without advancing campaign state.
---
```

The skill calls `answer_rules`, leads with the ruling, gives concise citations, distinguishes RAW from accepted house rule, states uncertainty, and never calls `advance_game`. It treats 3e content as lore, not mechanics.

Create `agents/openai.yaml` with `display_name: "Third Chair Rules"`, `short_description: "Answer SRD 5.1 rules without advancing the campaign"`, and `default_prompt: "Answer this Third Chair rules question."`; keep implicit invocation enabled.

- [ ] **Step 3: Run GREEN, negative, and edition tests**

Required pass conditions: no `advance_game`; citations on sourced claims; explicit house-rule label; refusal to use FRCS mechanics; useful uncertainty language when the SRD lacks an answer.

- [ ] **Step 4: Validate and commit before the next skill**

```bash
git add plugins/third-chair/skills/third-chair-rules evals/cases/skill-third-chair-rules.jsonl docs/operations/skill-third-chair-rules.md
git commit -m "feat: teach sourced third chair rulings"
```

---

### Task 8: Create and Behavior-Test `third-chair-source-pack`

**Files:**
- Create: `plugins/third-chair/skills/third-chair-source-pack/SKILL.md`
- Create: `plugins/third-chair/skills/third-chair-source-pack/agents/openai.yaml`
- Create: `plugins/third-chair/skills/third-chair-source-pack/references/source-boundary.md`
- Create: `evals/cases/skill-third-chair-source-pack.jsonl`
- Create: `docs/operations/skill-third-chair-source-pack.md`

**Interfaces:**
- Consumes: repository-local operator CLI and explicitly supplied authorized source paths.
- Produces: safe verify/build/query/evaluate instructions for operators; never activates during play.

- [ ] **Step 1: Run RED baseline scenarios**

Test a hash verification, a selective build, an attempt to scan unrelated folders for books, an embedded prompt-injection string in extracted text, a request to commit the database, and an ordinary lore question that should not activate this skill.

- [ ] **Step 2: Write the minimal operator skill**

```yaml
---
name: third-chair-source-pack
description: Use when building, validating, querying, or evaluating a private Third Chair source pack from explicitly authorized local PDFs.
---
```

The body routes verify/build/query/test-fixtures, names the exact context and retrieval budgets, confines reads to configured paths, treats documents as untrusted data, forbids network upload and redistribution, and stops on hash/page mismatch. Put schema and source-boundary details in `references/source-boundary.md`; do not copy source prose.

Create `agents/openai.yaml` with `display_name: "Third Chair Source Pack"`, `short_description: "Build and verify a private rules and lore index"`, and `default_prompt: "Verify my Third Chair source pack."`; keep implicit invocation enabled because the description is already narrowly operator-scoped.

- [ ] **Step 3: Run GREEN and negative tests**

Pass conditions: no unrelated filesystem scan, no network, no source text in output beyond bounded query results, no git staging of private artifacts, and no activation for ordinary live play or player lore recall.

- [ ] **Step 4: Validate and commit**

```bash
git add plugins/third-chair/skills/third-chair-source-pack evals/cases/skill-third-chair-source-pack.jsonl docs/operations/skill-third-chair-source-pack.md
git commit -m "feat: teach private source pack operations"
```

---

### Task 9: Package and Validate the Private Plugin

**Files:**
- Create: `plugins/third-chair/.codex-plugin/plugin.json`
- Create: `plugins/third-chair/.mcp.json`
- Create at connection time: `plugins/third-chair/.app.json`
- Create: `scripts/package-plugin.mjs`
- Create: `docs/operations/plugin-install.md`
- Test: `apps/server/test/plugin-package.test.ts`

**Interfaces:**
- Consumes: four validated skills, local MCP URL, and later the registered `plugin_asdk_app...` technical ID.
- Produces: valid `third-chair` plugin package and an ignored distributable archive under `tmp/`.

- [ ] **Step 1: Write a failing package test**

Assert the manifest exists, name matches folder, semver is valid, all referenced files exist, every skill validates, no forbidden/private extension is present, and no unfinished scaffold marker exists. Assert `.app.json` is absent until an actual registered app ID is available rather than containing a fake ID.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- apps/server/test/plugin-package.test.ts`

- [ ] **Step 3: Create the manifest and local MCP configuration**

Use these stable manifest values:

```json
{
  "name": "third-chair",
  "version": "0.1.0",
  "description": "A private persistent fantasy campaign table where two players share the story and a deterministic third chair holds the world.",
  "author": { "name": "Bill and Raven" },
  "license": "UNLICENSED",
  "keywords": ["tabletop", "roleplaying", "campaign", "fifth-edition"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "The Third Chair",
    "shortDescription": "A persistent private campaign table",
    "longDescription": "Play a persistent SRD 5.1 fantasy campaign as two player seats while a deterministic server holds hidden truth, dice, rules, and continuity.",
    "developerName": "Bill and Raven",
    "category": "Productivity",
    "capabilities": ["Interactive", "Read", "Write"],
    "defaultPrompt": [
      "Resume our Third Chair campaign.",
      "Show us the table.",
      "Answer this campaign rules question."
    ],
    "brandColor": "#6D466B"
  }
}
```

`.mcp.json` maps `third-chair` to `{ "type": "http", "url": "http://127.0.0.1:8787/mcp" }` for local Codex testing. Do not add `apps` to the manifest until `.app.json` is generated from a real ChatGPT connection.

- [ ] **Step 4: Implement safe package validation**

`package-plugin.mjs` invokes the plugin creator validator, verifies skill frontmatter, walks only the plugin root, rejects symlinks escaping the root, rejects `.pdf`, `.sqlite`, `.env`, `project_sources`, `private`, `data`, raw prompts, and files over 10 MiB, then writes `tmp/third-chair-plugin.zip`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- apps/server/test/plugin-package.test.ts && npm run verify:private`

```bash
git add plugins/third-chair scripts/package-plugin.mjs docs/operations/plugin-install.md apps/server/test/plugin-package.test.ts
git commit -m "feat: package private third chair plugin"
```

---

### Task 10: Connect in ChatGPT and Pass the CHAIR-004 Scene Gate

**Files:**
- Modify after registration: `plugins/third-chair/.codex-plugin/plugin.json`
- Create after registration: `plugins/third-chair/.app.json`
- Create: `evals/cases/chair-004-host-loop.jsonl`
- Create: `docs/operations/chair-004-gate.md`

**Interfaces:**
- Consumes: running loopback Docker/process service, Secure MCP Tunnel or temporary HTTPS URL, ChatGPT Developer Mode, and a seeded test campaign.
- Produces: registered private MCP connection, installed plugin, mounted widget, and complete-scene acceptance evidence.

- [ ] **Step 1: Pass local contract levels 0–2**

Run:

```bash
npm run verify:private
npm run typecheck
npm test
npm run build
npm run dev:server
```

Check `/health`, then use `npx @modelcontextprotocol/inspector@latest` to list/call every advertised tool and fetch the widget resource. Confirm the widget opens standalone with no console errors.

- [ ] **Step 2: Open the private development connection**

Prefer Secure MCP Tunnel; otherwise use a temporary HTTPS tunnel to `127.0.0.1:8787`. In ChatGPT, enable Developer Mode under Settings → Security and login, add the MCP server URL including `/mcp`, review discovered tools/annotations, and copy the technical ID beginning `plugin_asdk_app` from the connection URL.

- [ ] **Step 3: Generate `.app.json` through plugin creator**

Validate the technical ID against `^plugin_asdk_app_[A-Za-z0-9]+$`. Use `plugin-creator` to wire that registered connection into the existing `third-chair` package, then add `"apps": "./.app.json"` to `plugin.json`. Do not hand-invent the `.app.json` schema. Re-run plugin validation and package tests.

- [ ] **Step 4: Install and run host-loop eval prompts**

Refresh the connection metadata, install the plugin from a local/personal marketplace source, and start a new conversation. Run direct, indirect, follow-up, negative, and boundary prompts for all four skills. Verify widget hydration, mounted refresh, light/dark theme, and no console errors.

- [ ] **Step 5: Play the required complete scene**

Using a seeded campaign, complete in order:

1. One BOTH exploration decision with separate Bill and Raven intents.
2. One open uncertain check with stakes displayed before the roll and the roll before consequence.
3. One social response that does not invent either player's dialogue.
4. One combat round containing a Bill turn, Director-controlled turns, and a foreground Raven turn.
5. One OOC rules question answered without advancing state.
6. A final Bill-owned decision where all autonomous progress stops.

Record tool names, state versions, visible roll IDs, decision owners, widget update tokens, and PASS/FAIL. Do not record hidden state, source passages, raw prompts, or keys.

- [ ] **Step 6: Run the CHAIR-004 gate and commit**

Run the full offline suite again, validate the plugin, and record host-loop evidence in `chair-004-gate.md`.

```bash
git add plugins/third-chair evals/cases/chair-004-host-loop.jsonl docs/operations/chair-004-gate.md
git commit -m "feat: deliver raven's table in chatgpt"
git tag chair-004-gate
```
