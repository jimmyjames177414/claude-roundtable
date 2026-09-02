import { describe, it, expect } from "vitest";
import { runDebate, parsePersonas, parseRounds } from "../src/debate";
import type { ChatClient, ChatStream, ChatStreamParams } from "../src/debate";

function createMockClient(textFor: (callIndex: number, params: ChatStreamParams) => string) {
  const calls: ChatStreamParams[] = [];
  const client: ChatClient = {
    messages: {
      stream(params: ChatStreamParams) {
        calls.push(params);
        const index = calls.length - 1;
        let textHandler: ((t: string) => void) | undefined;
        const stream: ChatStream = {
          on(event, listener) {
            if (event === "text") textHandler = listener;
            return stream;
          },
          async finalMessage() {
            const text = textFor(index, params);
            textHandler?.(text);
            return { content: [{ type: "text", text }] };
          },
        };
        return stream;
      },
    },
  };
  return { client, calls };
}

describe("runDebate turn alternation", () => {
  it("alternates A,B for the given number of rounds", async () => {
    const { client, calls } = createMockClient((i) => `reply-${i}`);
    const { transcript } = await runDebate(client, {
      topic: "t",
      personaA: "Proponent",
      personaB: "Skeptic",
      rounds: 3,
      model: "claude-sonnet-5",
      judge: false,
    });

    expect(transcript.map((e) => e.speaker)).toEqual([
      "Proponent",
      "Skeptic",
      "Proponent",
      "Skeptic",
      "Proponent",
      "Skeptic",
    ]);
    expect(calls.length).toBe(6);
    expect(transcript.map((e) => e.text)).toEqual([
      "reply-0",
      "reply-1",
      "reply-2",
      "reply-3",
      "reply-4",
      "reply-5",
    ]);
  });

  it("makes exactly rounds*2 calls for a single round", async () => {
    const { client, calls } = createMockClient((i) => `reply-${i}`);
    await runDebate(client, {
      topic: "t",
      personaA: "A",
      personaB: "B",
      rounds: 1,
      model: "claude-sonnet-5",
      judge: false,
    });
    expect(calls.length).toBe(2);
  });
});

describe("runDebate judge", () => {
  it("adds exactly one Moderator call after all rounds when judge is true", async () => {
    const { client, calls } = createMockClient((i) => `reply-${i}`);
    const { transcript, verdict } = await runDebate(client, {
      topic: "t",
      personaA: "A",
      personaB: "B",
      rounds: 1,
      model: "claude-sonnet-5",
      judge: true,
    });

    expect(transcript.length).toBe(2);
    expect(calls.length).toBe(3);
    expect(calls[2].system).toMatch(/Moderator/);
    expect(verdict).toBe("reply-2");
  });

  it("makes no Moderator call when judge is false", async () => {
    const { client, calls } = createMockClient((i) => `reply-${i}`);
    const { verdict } = await runDebate(client, {
      topic: "t",
      personaA: "A",
      personaB: "B",
      rounds: 1,
      model: "claude-sonnet-5",
      judge: false,
    });
    expect(calls.length).toBe(2);
    expect(verdict).toBeUndefined();
  });

  it("calls the Moderator only after every debate round has run, for multiple rounds", async () => {
    const { client, calls } = createMockClient((i) => `reply-${i}`);
    await runDebate(client, {
      topic: "t",
      personaA: "A",
      personaB: "B",
      rounds: 2,
      model: "claude-sonnet-5",
      judge: true,
    });
    expect(calls.length).toBe(5); // 2 rounds * 2 personas + 1 moderator
    expect(calls[4].system).toMatch(/Moderator/);
    expect(calls[0].system).not.toMatch(/Moderator/);
  });
});

describe("parsePersonas", () => {
  it("parses two comma-separated labels", () => {
    expect(parsePersonas("Proponent,Skeptic")).toEqual(["Proponent", "Skeptic"]);
  });

  it("trims whitespace around labels", () => {
    expect(parsePersonas(" Alice , Bob ")).toEqual(["Alice", "Bob"]);
  });

  it("throws when not exactly two labels are given", () => {
    expect(() => parsePersonas("OnlyOne")).toThrow();
    expect(() => parsePersonas("A,B,C")).toThrow();
    expect(() => parsePersonas("")).toThrow();
  });
});

describe("parseRounds", () => {
  it("parses a positive integer", () => {
    expect(parseRounds("3")).toBe(3);
    expect(parseRounds("1")).toBe(1);
  });

  it("throws on non-positive or non-numeric input", () => {
    expect(() => parseRounds("0")).toThrow();
    expect(() => parseRounds("abc")).toThrow();
    expect(() => parseRounds("-1")).toThrow();
    expect(() => parseRounds("3.5")).toThrow();
  });
});
