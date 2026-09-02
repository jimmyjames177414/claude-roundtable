import Anthropic from "@anthropic-ai/sdk";
import { run } from "./cli";

run({
  args: process.argv.slice(2),
  env: process.env,
  createClient: (apiKey: string) => new Anthropic({ apiKey }),
  write: (s: string) => {
    process.stdout.write(s);
  },
  writeError: (s: string) => {
    process.stderr.write(s);
  },
}).then((code) => {
  process.exitCode = code;
});
