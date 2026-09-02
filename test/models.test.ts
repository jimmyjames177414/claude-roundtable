import { describe, it, expect } from "vitest";
import { resolveModel, isPlausibleModelId, DEFAULT_MODEL, FAST_MODEL, CliError } from "../src/models";

describe("resolveModel", () => {
  it("returns the default model when no flags are given", () => {
    expect(resolveModel({})).toBe(DEFAULT_MODEL);
  });

  it("returns the fast model when --fast is set", () => {
    expect(resolveModel({ fast: true })).toBe(FAST_MODEL);
  });

  it("returns a valid custom --model override", () => {
    expect(resolveModel({ model: "claude-opus-4-8" })).toBe("claude-opus-4-8");
  });

  it("throws a clear CliError for an unrecognized --model value", () => {
    expect(() => resolveModel({ model: "gpt-4o" })).toThrow(CliError);
    expect(() => resolveModel({ model: "totally-bogus" })).toThrow(
      /doesn't look like a real Claude model id/,
    );
  });

  it("throws a clear CliError when --model and --fast are both given", () => {
    expect(() => resolveModel({ model: "claude-sonnet-5", fast: true })).toThrow(CliError);
    expect(() => resolveModel({ model: "claude-sonnet-5", fast: true })).toThrow(
      /mutually exclusive/,
    );
  });
});

describe("isPlausibleModelId", () => {
  it("accepts real-looking ids", () => {
    expect(isPlausibleModelId("claude-sonnet-5")).toBe(true);
    expect(isPlausibleModelId("claude-haiku-4-5-20251001")).toBe(true);
    expect(isPlausibleModelId("claude-opus-4-8")).toBe(true);
  });

  it("rejects obviously wrong ids", () => {
    expect(isPlausibleModelId("gpt-4o")).toBe(false);
    expect(isPlausibleModelId("")).toBe(false);
    expect(isPlausibleModelId("llama-3")).toBe(false);
  });
});
