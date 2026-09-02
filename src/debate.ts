import { CliError } from "./models";

export const MODERATOR = "Moderator";
const MAX_TOKENS = 500;

export interface TranscriptEntry {
  speaker: string;
  text: string;
}

export interface ChatStream {
  on(event: "text", listener: (text: string) => void): ChatStream;
  finalMessage(): Promise<unknown>;
}

export interface ChatStreamParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user"; content: string }[];
  output_config?: { effort: "low" | "medium" | "high" | "xhigh" | "max" };
}

export interface ChatClient {
  messages: {
    stream(params: ChatStreamParams): ChatStream;
  };
}

export interface RunDebateOptions {
  topic: string;
  personaA: string;
  personaB: string;
  rounds: number;
  model: string;
  judge: boolean;
}

export interface DebateCallbacks {
  onTurnStart?: (speaker: string) => void;
  onText?: (speaker: string, chunk: string) => void;
  onTurnEnd?: (speaker: string, fullText: string) => void;
}

export interface RunDebateResult {
  transcript: TranscriptEntry[];
  verdict?: string;
}

export function parsePersonas(raw: string): [string, string] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length !== 2) {
    throw new CliError(
      `--personas must have exactly two comma-separated labels (got: "${raw}").`,
    );
  }

  return [parts[0], parts[1]];
}

export function parseRounds(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || String(n) !== raw.trim()) {
    throw new CliError(`--rounds must be a positive integer (got: "${raw}").`);
  }
  return n;
}

function formatTranscript(transcript: TranscriptEntry[]): string {
  if (transcript.length === 0) {
    return "(No turns yet. You are opening the debate.)";
  }
  return transcript.map((e) => `${e.speaker}: ${e.text}`).join("\n\n");
}

function buildPersonaSystemPrompt(speaker: string, opponent: string, topic: string): string {
  return [
    `You are "${speaker}", one of two debaters in a live, adversarial debate about: "${topic}".`,
    `Argue consistently from the "${speaker}" position, against "${opponent}".`,
    `Directly rebut the opponent's most recent point with a specific counter-argument; if there is no prior point yet, open with your strongest opening argument.`,
    `Keep your response to roughly 2-4 sentences - punchy and demo-friendly, not a lecture.`,
    `Respond with only your spoken line: no speaker label, no stage directions, no surrounding quotation marks.`,
  ].join(" ");
}

function buildModeratorSystemPrompt(topic: string): string {
  return [
    `You are "${MODERATOR}", an impartial judge reviewing a debate about: "${topic}".`,
    `Read the full transcript and render a short, decisive verdict: name which side argued more convincingly and why.`,
    `Be decisive, not diplomatic - do not simply summarize both sides as equally valid.`,
    `Keep it to 3-5 sentences.`,
    `Respond with only your verdict: no speaker label.`,
  ].join(" ");
}

async function streamTurn(
  client: ChatClient,
  model: string,
  system: string,
  userContent: string,
  onText?: (chunk: string) => void,
): Promise<string> {
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: userContent }],
    output_config: { effort: "low" },
  });

  let full = "";
  stream.on("text", (chunk: string) => {
    full += chunk;
    onText?.(chunk);
  });

  await stream.finalMessage();
  return full;
}

export async function runDebate(
  client: ChatClient,
  options: RunDebateOptions,
  callbacks: DebateCallbacks = {},
): Promise<RunDebateResult> {
  const { topic, personaA, personaB, rounds, model, judge } = options;
  const transcript: TranscriptEntry[] = [];
  const pairs: [string, string][] = [
    [personaA, personaB],
    [personaB, personaA],
  ];

  for (let round = 0; round < rounds; round++) {
    for (const [speaker, opponent] of pairs) {
      callbacks.onTurnStart?.(speaker);
      const system = buildPersonaSystemPrompt(speaker, opponent, topic);
      const userContent = `Topic: "${topic}"\n\nTranscript so far:\n${formatTranscript(transcript)}\n\nNow speak as "${speaker}".`;
      const text = await streamTurn(client, model, system, userContent, (chunk) =>
        callbacks.onText?.(speaker, chunk),
      );
      transcript.push({ speaker, text });
      callbacks.onTurnEnd?.(speaker, text);
    }
  }

  let verdict: string | undefined;
  if (judge) {
    callbacks.onTurnStart?.(MODERATOR);
    const system = buildModeratorSystemPrompt(topic);
    const userContent = `Topic: "${topic}"\n\nFull transcript:\n${formatTranscript(transcript)}\n\nRender your verdict now.`;
    verdict = await streamTurn(client, model, system, userContent, (chunk) =>
      callbacks.onText?.(MODERATOR, chunk),
    );
    callbacks.onTurnEnd?.(MODERATOR, verdict);
  }

  return { transcript, verdict };
}
