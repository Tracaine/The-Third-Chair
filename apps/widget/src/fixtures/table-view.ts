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

const bill = actor("test_actor_bill", "BILL", "Bill", 24, 17, [], [
  { id: "test_bill_second_wind", name: "Second Wind", current: 1, maximum: 1 },
]);
const raven = actor("test_actor_raven", "RAVEN", "Raven", 16, 15, ["Inspired"], [
  { id: "test_raven_spell_slots", name: "Spell slots", current: 2, maximum: 3 },
  { id: "test_raven_luck", name: "Mischief", current: 1, maximum: 2 },
]);

const visibleCheck: VisibleCheck = {
  id: "test_check_ledger",
  planId: "test_plan_cellar",
  actorId: "test_actor_raven",
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
  campaignId: "test_campaign_lantern",
  stateVersion: 12,
  worldDate: { yearDr: 1375, month: "Mirtul", day: 14 },
  location: {
    id: "test_location_lantern_cellar",
    name: "The Lantern Cellar",
    status: "Infiltrated",
    facts: [
      { id: "test_objective_cellar", kind: "Objective", text: "Find who marked the smuggler's ledger." },
      { id: "test_pressure_stairs", kind: "Pressure", text: "Footsteps are descending the stairs." },
    ],
  },
  sceneId: "test_scene_cellar_ledger",
  actors: [bill, raven],
  inventory: [],
  npcs: [],
  factions: [],
  facts: [
    { id: "test_clue_wax", kind: "Clue", text: "The violet wax matches House Veyra." },
    { id: "test_clue_tide", kind: "Clue", text: "Every payment lands at low tide." },
  ],
  events: [
    { id: "test_event_ledger", kind: "Discovery", text: "Raven decoded the ledger's margin marks." },
  ],
  clocks: [],
  openThreads: [
    {
      id: "test_thread_watch",
      name: "Who is paying the dock watch?",
      status: "Open",
      facts: [{ id: "test_thread_watch_fact", kind: "Lead", text: "Ask at the Bent Nail after midnight." }],
    },
  ],
  combat: null,
  currentDecision: {
    id: "test_decision_cellar_escape",
    stateVersion: 12,
    mode: "EXPLORATION",
    owner: "BILL",
    situation: "The cellar door is the only quiet way out.",
    eligibleActorIds: ["test_actor_bill"],
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
  playerViewId: "a".repeat(64),
  audience: "BILL",
  playerView: baseView,
  visibleChecks: [visibleCheck],
  lastMutationId: "test_turn_0012",
  serverStatus: "READY",
  actorNames: { test_actor_bill: "Bill", test_actor_raven: "Raven" },
  hiddenFixtureFields: ["The patron is Lady Sablethorn."],
};

export const combatFixture: typeof explorationFixture = {
  ...explorationFixture,
  playerView: {
    ...baseView,
    stateVersion: 18,
    location: {
      id: "test_location_docks",
      name: "Stormhaven Docks",
      status: "Contested",
      facts: [
        { id: "test_objective_crane", kind: "Objective", text: "Keep the ledger out of the cutthroats' hands." },
        { id: "test_pressure_fire", kind: "Pressure", text: "Fire is crawling toward the mooring lines." },
      ],
    },
    npcs: [
      {
        id: "test_npc_cutthroat",
        name: "Dockside Cutthroat",
        status: "Hostile",
        facts: [{ id: "test_npc_cutthroat_fact", kind: "Visible", text: "Bloodied, carrying a hooked blade" }],
      },
    ],
    combat: {
      id: "test_combat_docks",
      round: 3,
      currentActorId: "test_actor_raven",
      initiativeOrder: ["test_actor_raven", "test_npc_cutthroat", "test_actor_bill"],
      facts: [
        { id: "test_terrain_cart", kind: "Terrain", text: "Overturned fish cart" },
        { id: "test_hazard_oil", kind: "Hazard", text: "Burning lamp oil" },
        { id: "test_interactable_crane", kind: "Interactable", text: "Cargo crane release" },
      ],
    },
    currentDecision: {
      id: "test_decision_raven_combat",
      stateVersion: 18,
      mode: "COMBAT",
      owner: "RAVEN",
      situation: "The cutthroat has Bill pinned against the pier rail.",
      eligibleActorIds: ["test_actor_raven"],
      constraints: "The burning oil blocks the direct path.",
      requiredInput: "Raven chooses her action.",
      legalOptions: [],
    },
  },
  actorNames: {
    test_actor_bill: "Bill",
    test_actor_raven: "Raven",
    test_npc_cutthroat: "Dockside Cutthroat",
  },
  hiddenFixtureFields: ["Invisible assassin", "The patron is Lady Sablethorn."],
};
