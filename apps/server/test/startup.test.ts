import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { performStartup, StartupFailure, startupErrorDiagnostic } from "../src/startup.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixtureEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const root = mkdtempSync(join(tmpdir(), "third-chair-startup-"));
  roots.push(root);
  const widget = join(root, "widget.html");
  writeFileSync(widget, "<!doctype html><title>Raven's Table</title>");
  return {
    THIRD_CHAIR_DATABASE: join(root, "data", "campaigns.sqlite"),
    THIRD_CHAIR_EXPORT_DIRECTORY: join(root, "exports"),
    THIRD_CHAIR_WIDGET_BUILD: widget,
    THIRD_CHAIR_TRACE_MODE: "off",
    ...extra,
  };
}

describe("runtime startup preflight", () => {
  it("reaches clean readiness with fake models and a built widget", () => {
    const result = performStartup(fixtureEnv({ THIRD_CHAIR_FAKE_MODE: "1" }));
    expect(result.status).toBe("ready");
    expect(result.widgetResource.text).toContain("Raven's Table");
    result.db.close();
  });

  it("starts degraded when the mounted source pack is absent", () => {
    const env = fixtureEnv({ SOURCE_PACK_DB_PATH: join(tmpdir(), `missing-source-${Date.now()}.sqlite`) });
    const result = performStartup(env);
    expect(result).toMatchObject({ status: "degraded", recoveryCode: "SOURCE_PACK_UNAVAILABLE" });
    result.db.close();
  });

  it("refuses normal-play tracing before creating the database", () => {
    const env = fixtureEnv({ THIRD_CHAIR_TRACE_MODE: "on" });
    expect(() => performStartup(env)).toThrow("NORMAL_PLAY_TRACING_FORBIDDEN");
    expect(existsSync(env.THIRD_CHAIR_DATABASE!)).toBe(false);
  });

  it("refuses readiness when the widget build is absent", () => {
    const env = fixtureEnv({ THIRD_CHAIR_FAKE_MODE: "1", THIRD_CHAIR_WIDGET_BUILD: join(tmpdir(), `missing-widget-${Date.now()}.html`) });
    expect(() => performStartup(env)).toThrow("WIDGET_BUILD_MISSING");
    expect(existsSync(env.THIRD_CHAIR_DATABASE!)).toBe(false);
  });

  it("reports the safe root startup failure without leaking exception text", () => {
    const error = new StartupFailure("STARTUP_PREFLIGHT_FAILED", {
      cause: new Error("DATABASE_MIGRATION_FAILED", { cause: new Error("CAMPAIGN_START_HASH_MISMATCH") }),
    });
    expect(startupErrorDiagnostic(error)).toEqual({
      level: "error",
      code: "STARTUP_PREFLIGHT_FAILED",
      detailCode: "CAMPAIGN_START_HASH_MISMATCH",
    });
  });
});
