import { Command, CommanderError } from "commander";
import chalk from "chalk";
import { CliError, resolveModel } from "./models";
import { parsePersonas, parseRounds, runDebate, type ChatClient } from "./debate";

export interface CliDeps {
  args: string[];
  env: NodeJS.ProcessEnv;
  createClient: (apiKey: string) => ChatClient;
  write: (s: string) => void;
  writeError: (s: string) => void;
}

interface ParsedOptions {
  rounds: string;
  personas: string;
  judge: boolean;
  model?: string;
  fast: boolean;
}

function buildProgram(deps: CliDeps): Command {
  const program = new Command();
  program
    .name("roundtable")
    .description('Two Claude personas argue a topic adversarially in your terminal.')
    .argument("<topic>", "the topic for the two personas to debate")
    .option("--rounds <n>", "number of exchanges per persona", "3")
    .option("--personas <a,b>", "two persona labels/stances, comma-separated", "Proponent,Skeptic")
    .option("--judge", "have a Moderator render a final verdict after all rounds", false)
    .option("--model <id>", "override the Claude model id")
    .option("--fast", "use the fast/cheap Haiku model (mutually exclusive with --model)", false)
    .exitOverride()
    .configureOutput({
      writeOut: (str) => deps.write(str),
      writeErr: (str) => deps.writeError(str),
    });
  return program;
}

function colorFor(speaker: string, personaA: string, personaB: string): (s: string) => string {
  if (speaker === personaA) return (s) => chalk.cyan.bold(s);
  if (speaker === personaB) return (s) => chalk.magenta.bold(s);
  return (s) => chalk.green.bold(s);
}

export async function run(deps: CliDeps): Promise<number> {
  const program = buildProgram(deps);

  let topic: string;
  let opts: ParsedOptions;
  try {
    program.parse(deps.args, { from: "user" });
    topic = program.args[0];
    opts = program.opts<ParsedOptions>();
  } catch (err) {
    if (err instanceof CommanderError) {
      return err.code === "commander.helpDisplayed" || err.code === "commander.version" ? 0 : 1;
    }
    return 1;
  }

  try {
    const model = resolveModel({ model: opts.model, fast: opts.fast });
    const [personaA, personaB] = parsePersonas(opts.personas);
    const rounds = parseRounds(opts.rounds);

    if (!deps.env.ANTHROPIC_API_KEY) {
      deps.writeError(
        "Missing ANTHROPIC_API_KEY. Get one at https://console.anthropic.com and export it, then try again.\n",
      );
      return 1;
    }

    const client = deps.createClient(deps.env.ANTHROPIC_API_KEY);

    await runDebate(
      client,
      { topic, personaA, personaB, rounds, model, judge: Boolean(opts.judge) },
      {
        onTurnStart(speaker) {
          const paint = colorFor(speaker, personaA, personaB);
          deps.write(`\n${paint(`${speaker}:`)}\n`);
        },
        onText(_speaker, chunk) {
          deps.write(chunk);
        },
        onTurnEnd() {
          deps.write("\n");
        },
      },
    );

    return 0;
  } catch (err) {
    if (err instanceof CliError) {
      deps.writeError(`Error: ${err.message}\n`);
      return 1;
    }
    const message = err instanceof Error ? err.message : String(err);
    deps.writeError(`Error: ${message}\n`);
    return 1;
  }
}
