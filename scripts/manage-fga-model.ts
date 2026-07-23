/**
 * Read or install the repository's FGA authorization model.
 *
 * Default mode is read-only. Applying is allowed only when the configured
 * store has no model, or when the exact required model is already present.
 * The script never prints credentials, store/model identifiers, or tuples.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import {
  isScriptFgaConfigured,
  scriptFgaReadAuthorizationModels,
  scriptFgaWriteAuthorizationModel,
} from "./lib/fga-client";
import {
  getFgaModelStoreState,
  matchesRequiredFgaModel,
  REQUIRED_FGA_MODEL,
} from "../lib/fgaModel";
import { CliUsageError, hasFlag, safeFailureMessage } from "./lib/safe-cli";

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/manage-fga-model.ts [options]

Safe default: read-only status. No model is written unless --apply is present.

Options:
  --dry-run                    Explicit read-only status (default)
  --apply                      Install the model only when the store is empty
  --help                       Show this help

This script refuses to add a new model version to a non-empty, mismatched store.
It never reads or writes relationship tuples.
`);
}

async function manageModel(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const apply = hasFlag(args, "--apply");
  const dryRun = hasFlag(args, "--dry-run");
  if (apply && dryRun) {
    throw new CliUsageError("--apply and --dry-run cannot be used together.");
  }
  const supportedArgs = new Set(["--apply", "--dry-run"]);
  const unknownArg = args.find((arg) => !supportedArgs.has(arg));
  if (unknownArg) {
    throw new CliUsageError(
      "Unknown argument; use --help for supported options.",
    );
  }
  if (!isScriptFgaConfigured()) {
    throw new CliUsageError(
      "FGA model check refused: the configured store credentials are incomplete.",
    );
  }

  const before = await scriptFgaReadAuthorizationModels();
  const stateBefore = getFgaModelStoreState(before);

  console.log("FGA authorization model");
  console.log(
    `Mode: ${apply ? "apply" : "read-only"}; modelsBefore=${before.length}; modelState=${stateBefore}.`,
  );

  if (!apply || stateBefore === "ready") {
    console.log("External model writes=0; relationship tuple reads/writes=0.");
    return;
  }
  if (stateBefore !== "empty") {
    throw new CliUsageError(
      "FGA model write refused: the store is non-empty, ambiguous, or does not contain exactly the required model.",
    );
  }

  const confirmedEmpty = await scriptFgaReadAuthorizationModels();
  if (getFgaModelStoreState(confirmedEmpty) !== "empty") {
    throw new Error(
      "FGA model write refused: store state changed before write.",
    );
  }

  const writtenModelId =
    await scriptFgaWriteAuthorizationModel(REQUIRED_FGA_MODEL);
  const after = await scriptFgaReadAuthorizationModels();
  const writtenModel = after.find((model) => model.id === writtenModelId);
  if (
    getFgaModelStoreState(after) !== "ready" ||
    !writtenModel ||
    !matchesRequiredFgaModel(writtenModel)
  ) {
    throw new Error("FGA model verification failed after write.");
  }

  console.log(
    `Verified: modelsAfter=${after.length}; requiredModelPresent=true; externalModelWrites=1; relationshipTupleWrites=0.`,
  );
}

manageModel().catch((error) => {
  console.error(safeFailureMessage("FGA authorization model", error));
  process.exitCode = 1;
});
