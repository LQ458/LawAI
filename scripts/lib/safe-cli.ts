import * as fs from "fs";
import * as path from "path";

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function getArg(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (
    index >= 0 &&
    index + 1 < args.length &&
    !args[index + 1].startsWith("--")
  ) {
    return args[index + 1];
  }
  return undefined;
}

export function getIntegerArg(
  args: string[],
  name: string,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const raw = getArg(args, name);
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new CliUsageError(`${name} must be an integer`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new CliUsageError(`${name} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new CliUsageError(`${name} must be at most ${options.max}`);
  }
  return value;
}

export function assertDestructiveConfirmation(
  args: string[],
  destructiveRequested: boolean,
): void {
  if (!destructiveRequested) return;

  if (
    !hasFlag(args, "--confirm-destructive") ||
    !hasFlag(args, "--backup-acknowledged")
  ) {
    throw new CliUsageError(
      "Destructive operation refused. Re-run with both --confirm-destructive and --backup-acknowledged after verifying a recoverable backup.",
    );
  }
}

export function resolveCheckpointPath(
  args: string[],
  defaultFilename: string,
): string {
  const configured = getArg(args, "--checkpoint");
  return path.resolve(
    configured || path.join(process.cwd(), ".checkpoints", defaultFilename),
  );
}

export function readCheckpoint<T>(checkpointPath: string): T | undefined {
  if (!fs.existsSync(checkpointPath)) return undefined;
  const parsed: unknown = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Checkpoint is not a JSON object");
  }
  return parsed as T;
}

export function writeCheckpoint<T>(
  checkpointPath: string,
  checkpoint: T,
): void {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  const temporaryPath = `${checkpointPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(checkpoint)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, checkpointPath);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number) => void;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      options.onRetry?.(attempt + 1);
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)),
      );
    }
  }

  const failure = new Error(`Operation failed after ${attempts} attempts`);
  Object.defineProperty(failure, "cause", {
    value: lastError,
    enumerable: false,
  });
  throw failure;
}

export function safeFailureMessage(scope: string, error?: unknown): string {
  if (error instanceof CliUsageError) {
    return error.message;
  }
  return `${scope} failed; no document text or identifiers were logged. Resume from the last successful checkpoint.`;
}
