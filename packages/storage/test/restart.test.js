import { describe, expect, it } from "vitest";
import { createTurnRepository, openCampaignDatabase, } from "@third-chair/storage";
import { beginInput, checkResolution, createTempDatabase, decision, resolutionPlan, seedCampaign, } from "./fixtures.js";
describe("turn restart recovery", () => {
    it.each([
        ["PROCESSING", (_repo, _turnId) => undefined],
        ["PLANNED", (repo, turnId) => {
                repo.persistPlan(turnId, resolutionPlan(turnId));
            }],
        ["RESOLVED", (repo, turnId) => {
                const plan = resolutionPlan(turnId);
                repo.persistPlan(turnId, plan);
                repo.persistResolutions(turnId, [checkResolution(turnId, plan.id, 1, 17)], 1);
            }],
        ["AWAITING_INPUT", (repo, turnId) => {
                repo.markAwaitingInput(turnId, decision("awaiting", 0));
            }],
    ])("reopens and resumes a persisted %s turn", (status, stage) => {
        const temp = createTempDatabase();
        try {
            const suffix = status.toLowerCase();
            seedCampaign(temp.db, suffix);
            const input = beginInput(suffix);
            const repo = createTurnRepository(temp.db);
            repo.beginTurn(input);
            stage(repo, input.turnId);
            temp.close();
            const reopened = openCampaignDatabase(temp.path);
            const resumed = createTurnRepository(reopened).beginTurn(input);
            expect(resumed).toMatchObject({ kind: "EXISTING", turn: { id: input.turnId, status } });
            if (status === "PLANNED" || status === "RESOLVED") {
                expect(resumed.turn.resolutionPlan).toEqual(resolutionPlan(input.turnId));
            }
            if (status === "RESOLVED") {
                expect(resumed.turn).toMatchObject({
                    resolutions: [checkResolution(input.turnId, resolutionPlan(input.turnId).id, 1, 17)],
                    nextRngCounter: 1,
                });
            }
            expect(reopened.prepare("SELECT turn_id FROM active_turns").get()).toEqual({ turn_id: input.turnId });
            reopened.close();
        }
        finally {
            temp.cleanup();
        }
    });
    it("discovers the same reserved successor after reopening on a different request", () => {
        const temp = createTempDatabase();
        try {
            seedCampaign(temp.db, "successor_restart");
            const winner = beginInput("successor_restart");
            createTurnRepository(temp.db).beginTurn(winner);
            temp.close();
            const reopened = openCampaignDatabase(temp.path);
            const result = createTurnRepository(reopened).beginTurn({
                ...winner,
                turnId: "test_turn_successor_restart_other",
                clientRequestId: "test_request_successor_restart_other",
                inputHash: "other-hash",
            });
            expect(result).toMatchObject({ kind: "ACTIVE_SUCCESSOR", turn: { id: winner.turnId } });
            expect(reopened.prepare("SELECT count(*) AS count FROM turns").get()).toEqual({ count: 1 });
            reopened.close();
        }
        finally {
            temp.cleanup();
        }
    });
});
//# sourceMappingURL=restart.test.js.map