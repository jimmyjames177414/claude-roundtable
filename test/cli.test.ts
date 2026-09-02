import { describe, it, expect } from "vitest";
import { run, type CliDeps } from "../src/cli";
import type { ChatClient, ChatStream, ChatStreamParams } from "../src/debate";

function createMockClient() {
  const calls: ChatStreamParams[] = [];
  const client: ChatClient = {
    messages: {
      stream(params: ChatStreamParams) {
        calls.push(params);
        let textHandler: ((t: string) => void) | undefined;
        const stream: ChatStream = {
          on(event, listener) {
            if (event === "text") textHandler = listener;
            return stream;
          },
          async finalMessage() {
            textHandler?.("ok");
            return { content: [{ type: "text", text: "ok" }] };
          },
        };
        return stream;
      },
    },
  };
  return { client, calls };
}

function createDeps(overrides: Partial<CliDeps> = {}) {
  const { client, calls } = createMockClient();
  let createClientCalls = 0;
  const out: string[] = [];
  const err: string[] = [];
  const deps: CliDeps = {
    args: ["some topic"],
    env: { ANTHROPIC_API_KEY: "sk-test-key" },
    createClient: () => {
      createClientCalls++;
      return client;
    },
    write: (s: string) => out.push(s),
    writeError: (s: string) => err.push(s),
    ...overrides,
  };
  return { deps, calls, out, err, getCreateClientCalls: () => createClientCalls };
}

describe("cli run - error paths make no API call", () => {
  it("errors clearly when ANTHROPIC_API_KEY is missing, with no client created and no API call", async () => {
    const { deps, calls, getCreateClientCalls, err } = createDeps({ env: {} });
    const code = await run(deps);
    expect(code).toBe(1);
    expect(calls.length).toBe(0);
    expect(getCreateClientCalls()).toBe(0);
    expect(err.join("")).toMatch(/Missing ANTHROPIC_API_KEY/);
  });

  it("errors clearly on an unrecognized --model value, with no client created and no API call", async () => {
    const { deps, calls, getCreateClientCalls, err } = createDeps({
      args: ["some topic", "--model", "not-a-real-model"],
    });
    const code = await run(deps);
    expect(code).toBe(1);
    expect(calls.length).toBe(0);
    expect(getCreateClientCalls()).toBe(0);
    expect(err.join("")).toMatch(/doesn't look like a real Claude model id/);
  });

  it("errors clearly when --model and --fast are combined", async () => {
    const { deps, calls, getCreateClientCalls, err } = createDeps({
      args: ["some topic", "--model", "claude-sonnet-5", "--fast"],
    });
    const code = await run(deps);
    expect(code).toBe(1);
    expect(calls.length).toBe(0);
    expect(getCreateClientCalls()).toBe(0);
    expect(err.join("")).toMatch(/mutually exclusive/);
  });

  it("errors clearly when --personas does not have exactly two labels", async () => {
    const { deps, calls, err } = createDeps({
      args: ["some topic", "--personas", "OnlyOne"],
    });
    const code = await run(deps);
    expect(code).toBe(1);
    expect(calls.length).toBe(0);
    expect(err.join("")).toMatch(/exactly two/);
  });
});

describe("cli run - success paths", () => {
  it("runs a full debate and exits 0", async () => {
    const { deps, calls } = createDeps({ args: ["some topic", "--rounds", "1"] });
    const code = await run(deps);
    expect(code).toBe(0);
    expect(calls.length).toBe(2);
  });

  it("selects the fast model when --fast is passed", async () => {
    const { deps, calls } = createDeps({ args: ["some topic", "--rounds", "1", "--fast"] });
    const code = await run(deps);
    expect(code).toBe(0);
    expect(calls[0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("defaults to claude-sonnet-5 when no model flag is given", async () => {
    const { deps, calls } = createDeps({ args: ["some topic", "--rounds", "1"] });
    await run(deps);
    expect(calls[0].model).toBe("claude-sonnet-5");
  });

  it("adds one extra Moderator call when --judge is passed", async () => {
    const { deps, calls } = createDeps({ args: ["some topic", "--rounds", "1", "--judge"] });
    const code = await run(deps);
    expect(code).toBe(0);
    expect(calls.length).toBe(3);
  });

  it("streams turn output through deps.write", async () => {
    const { deps, out } = createDeps({ args: ["some topic", "--rounds", "1"] });
    await run(deps);
    expect(out.join("")).toContain("ok");
  });
});
