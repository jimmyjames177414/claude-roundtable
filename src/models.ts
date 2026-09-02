export const DEFAULT_MODEL = "claude-sonnet-5";
export const FAST_MODEL = "claude-haiku-4-5-20251001";

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const MODEL_ID_PATTERN = /^claude-[a-z0-9]+(?:[.-][a-z0-9]+)*$/i;

export function isPlausibleModelId(id: string): boolean {
  return MODEL_ID_PATTERN.test(id.trim());
}

export interface ModelOptions {
  model?: string;
  fast?: boolean;
}

export function resolveModel(opts: ModelOptions): string {
  if (opts.model && opts.fast) {
    throw new CliError(
      "--model and --fast are mutually exclusive. Pass one or the other, not both.",
    );
  }

  if (opts.fast) {
    return FAST_MODEL;
  }

  if (opts.model) {
    const trimmed = opts.model.trim();
    if (!isPlausibleModelId(trimmed)) {
      throw new CliError(
        `"${opts.model}" doesn't look like a real Claude model id (expected something like "claude-sonnet-5" or "claude-haiku-4-5-20251001").`,
      );
    }
    return trimmed;
  }

  return DEFAULT_MODEL;
}
