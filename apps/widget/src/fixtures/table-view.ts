import type { PlayerActorView, PlayerView } from "@third-chair/contracts";
import type { TableViewModel, VisibleCheck } from "../contracts";

const actor = (
  id: string,
  controller: "BILL" | "RAVEN",
  name: string,
  currentHp: number,
  armorClass: number,
  conditions: string[],
  resources: PlayerActorView["resources"],
): PlayerActorView => ({
  id,
  controller,
  name,
  level: 3,
  abilities: {
    strength: controller === "BILL" ? 16 : 8,
    dexterity: controller === "RAVEN" ? 16 : 12,
    constitution: 14,
    intelligence: controller === "RAVEN" ? 15 : 10,
    wisdom: 13,
    charisma: controller === "RAVEN" ? 14 : 11,
  },
  proficiencyBonus: 2,
  armorClass,
  maxHp: controller === "BILL" ? 28 : 21,
  currentHp,
  temporaryHp: 0,
  speed: 30,
  conditions,
  deathSaves: { successes: 0, failures: 0 },
  publicNotes: [controller === "BILL" ? "Shield at the ready" : "Silver-white feather tucked at her collar"],
  resources,
});

const bill = actor("actor_bill", "BILL", "Bill", 24, 17, [], [
  { id: "bill_second_wind", name: "Second Wind", current: 1, maximum: 1 },
]);
const raven = actor("actor_raven", "RAVEN", "Raven", 16, 15, ["Inspired"], [
  { id: "raven_spell_slots", name: "Spell slots", current: 2, maximum: 3 },
  { id: "raven_luck", name: "Mischief", current: 1, maximum: 2 },
]);

const visibleCheck: VisibleCheck = {
  id: "check_ledger",
  planId: "plan_cellar",
  actorId: "actor_raven",
  checkKind: "Investigation",
  key: "investigation",
  naturalDice: [14],
  keptDie: 14,
  modifier: 5,
  total: 19,
  target: 15,
  tier: "SUCCESS",
  visibility: "PUBLIC",
  advantage: "NORMAL",
  advantageReason: "Lamplight and time enough for one careful pass",
  successStakes: "Read the coded margin note.",
  failureStakes: "Alert whoever is on the stairs.",
  citations: ["SRD 5.1: Ability Checks"],
  startingCounter: 42,
  endingCounter: 43,
  consequence: "The cipher yields a noble house sigil before the footsteps arrive.",
};

const baseView: PlayerView = {
  campaignId: "campaign_lantern",
  stateVersion: 12,
  worldDate: { yearDr: 1375, month: "Mirtul", day: 14 },
  location: {
    id: "location_lantern_cellar",
    name: "The Lantern Cellar",
    status: "Infiltrated",
    facts: [
      { id: "objective_cellar", kind: "Objective", text: "Find who marked the smuggler's ledger." },
      { id: "pressure_stairs", kind: "Pressure", text: "Footsteps are descending the stairs." },
    ],
  },
  sceneId: "scene_cellar_ledger",
  actors: [bill, raven],
  inventory: [],
  npcs: [],
  factions: [],
  facts: [
    { id: "clue_wax", kind: "Clue", text: "The violet wax matches House Veyra." },
    { id: "clue_tide", kind: "Clue", text: "Every payment lands at low tide." },
  ],
  events: [
    { id: "event_ledger", kind: "Discovery", text: "Raven decoded the ledger's margin marks." },
  ],
  clocks: [],
  openThreads: [
    {
      id: "thread_watch",
      name: "Who is paying the dock watch?",
      status: "Open",
      facts: [{ id: "thread_watch_fact", kind: "Lead", text: "Ask at the Bent Nail after midnight." }],
    },
  ],
  combat: null,
  currentDecision: {
    id: "decision_cellar_escape",
    stateVersion: 12,
    mode: "EXPLORATION",
    owner: "BILL",
    situation: "The cellar door is the only quiet way out.",
    eligibleActorIds: ["actor_bill"],
    constraints: "The approaching group is less than a minute away.",
    requiredInput: "What do you do before the footsteps reach the cellar?",
    legalOptions: [],
  },
  recoveryStatus: "NONE",
};

export const explorationFixture: TableViewModel & {
  readonly actorNames: Readonly<Record<string, string>>;
  readonly hiddenFixtureFields: readonly string[];
} = {
  playerView: baseView,
  visibleChecks: [visibleCheck],
  lastMutationId: "turn_0012",
  serverStatus: "READY",
  actorNames: { actor_bill: "Bill", actor_raven: "Raven" },
  hiddenFixtureFields: ["The patron is Lady Sablethorn."],
};

export const combatFixture: typeof explorationFixture = {
  ...explorationFixture,
  playerView: {
    ...baseView,
    stateVersion: 18,
    location: {
      id: "location_docks",
      name: "Stormhaven Docks",
      status: "Contested",
      facts: [
        { id: "objective_crane", kind: "Objective", text: "Keep the ledger out of the cutthroats' hands." },
        { id: "pressure_fire", kind: "Pressure", text: "Fire is crawling toward the mooring lines." },
      ],
    },
    npcs: [
      {
        id: "npc_cutthroat",
        name: "Dockside Cutthroat",
        status: "Hostile",
        facts: [{ id: "npc_cutthroat_fact", kind: "Visible", text: "Bloodied, carrying a hooked blade" }],
      },
    ],
    combat: {
      id: "combat_docks",
      round: 3,
      currentActorId: "actor_raven",
      initiativeOrder: ["actor_raven", "npc_cutthroat", "actor_bill"],
      facts: [
        { id: "terrain_cart", kind: "Terrain", text: "Overturned fish cart" },
        { id: "hazard_oil", kind: "Hazard", text: "Burning lamp oil" },
        { id: "interactable_crane", kind: "Interactable", text: "Cargo crane release" },
      ],
    },
    currentDecision: {
      id: "decision_raven_combat",
      stateVersion: 18,
      mode: "COMBAT",
      owner: "RAVEN",
      situation: "The cutthroat has Bill pinned against the pier rail.",
      eligibleActorIds: ["actor_raven"],
      constraints: "The burning oil blocks the direct path.",
      requiredInput: "Raven chooses her action.",
      legalOptions: [],
    },
  },
  actorNames: {
    actor_bill: "Bill",
    actor_raven: "Raven",
    npc_cutthroat: "Dockside Cutthroat",
  },
  hiddenFixtureFields: ["Invisible assassin", "The patron is Lady Sablethorn."],
};
