import { run } from "./cli";

run({
  args: process.argv.slice(2),
  env: process.env,
  createClient: async (apiKey: string) => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    return new Anthropic({ apiKey });
  },
  write: (s: string) => {
    process.stdout.write(s);
  },
  writeError: (s: string) => {
    process.stderr.write(s);
  },
}).then((code) => {
  process.exit(code);
});
