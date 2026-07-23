import * as dotenv from "dotenv";
import * as path from "path";
import {
  buildDemoFgaTuples,
  RESTRICTED_DEMO_DOCUMENT_TUPLE_COUNT,
  type DemoAuth0Subjects,
} from "../lib/demoData";
import { createStableDocumentId } from "./lib/document-metadata";
import { scriptFgaWriteTuples } from "./lib/fga-client";
import {
  CliUsageError,
  getIntegerArg,
  hasFlag,
  readCheckpoint,
  resolveCheckpointPath,
  safeFailureMessage,
  withRetry,
  writeCheckpoint,
} from "./lib/safe-cli";

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

interface FgaSeedCheckpoint {
  schemaVersion: 1;
  nextIndex: number;
  mappingVersion: string;
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/seed-fga.ts [options]

Options:
  --dry-run                    Count only; no FGA writes
  --batch-size=N               Tuple batch size (default: 25)
  --resume-from=N              Resume at zero-based tuple N
  --checkpoint=PATH            Resume from/write a checkpoint
  --help                       Show this help

Live writes require DEMO_MANAGER_AUTH0_SUBJECT and
DEMO_EMPLOYEE_AUTH0_SUBJECT. DEMO_LEGAL_FINANCE_AUTH0_SUBJECT is optional.
Values are never printed or stored in the checkpoint.
`);
}

function liveSubjects(): DemoAuth0Subjects {
  const managerSubject = process.env.DEMO_MANAGER_AUTH0_SUBJECT;
  const employeeSubject = process.env.DEMO_EMPLOYEE_AUTH0_SUBJECT;
  if (!managerSubject || !employeeSubject) {
    throw new CliUsageError(
      "Live FGA seed refused: set DEMO_MANAGER_AUTH0_SUBJECT and DEMO_EMPLOYEE_AUTH0_SUBJECT to server-verified Auth0 subject values.",
    );
  }
  return {
    managerSubject,
    employeeSubject,
    legalFinanceSubject: process.env.DEMO_LEGAL_FINANCE_AUTH0_SUBJECT,
  };
}

async function seed(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const dryRun = hasFlag(args, "--dry-run");
  const batchSize = getIntegerArg(args, "--batch-size", 25, {
    min: 1,
    max: 100,
  });
  if (dryRun) {
    console.log("Synthetic demo FGA tuple seed");
    console.log(
      `Mode: dry-run; requiredSubjectMappings=2; optionalSubjectMappings=1; restrictedDocumentTuples=${RESTRICTED_DEMO_DOCUMENT_TUPLE_COUNT}; batch=${batchSize}.`,
    );
    console.log(
      "External writes=0; subject values and tuple identifiers output=0.",
    );
    return;
  }

  const subjects = liveSubjects();
  const tuples = buildDemoFgaTuples(subjects);
  const mappingVersion = createStableDocumentId(
    "demo-subject-mapping",
    JSON.stringify([
      subjects.managerSubject,
      subjects.employeeSubject,
      subjects.legalFinanceSubject || "",
    ]),
  );
  const explicitResume = args.some(
    (arg) => arg === "--resume-from" || arg.startsWith("--resume-from="),
  );
  const resumeFrom = getIntegerArg(args, "--resume-from", 0, {
    min: 0,
    max: tuples.length,
  });
  const explicitCheckpoint = args.some(
    (arg) => arg === "--checkpoint" || arg.startsWith("--checkpoint="),
  );
  const checkpointPath = resolveCheckpointPath(args, "seed-fga.json");
  const checkpoint = explicitCheckpoint
    ? readCheckpoint<FgaSeedCheckpoint>(checkpointPath)
    : undefined;
  if (checkpoint && checkpoint.mappingVersion !== mappingVersion) {
    throw new CliUsageError(
      "Checkpoint subject mapping does not match the current environment; start with a new checkpoint.",
    );
  }
  const startIndex = explicitResume ? resumeFrom : checkpoint?.nextIndex || 0;

  console.log("Synthetic demo FGA tuple seed");
  console.log(
    `Mode: write; total=${tuples.length}; start=${startIndex}; batch=${batchSize}.`,
  );

  for (let offset = startIndex; offset < tuples.length; offset += batchSize) {
    const batch = tuples.slice(offset, offset + batchSize).map((tuple) => ({
      user: tuple.user,
      relation: tuple.relation,
      object: tuple.object,
    }));
    await withRetry(() => scriptFgaWriteTuples(batch), {
      onRetry: (attempt) =>
        console.warn(`FGA write retry ${attempt}/3; tuple data omitted.`),
    });
    const nextIndex = offset + batch.length;
    writeCheckpoint<FgaSeedCheckpoint>(checkpointPath, {
      schemaVersion: 1,
      nextIndex,
      mappingVersion,
    });
    console.log(`Progress: written=${nextIndex}/${tuples.length}.`);
  }
}

seed().catch((error) => {
  console.error(safeFailureMessage("Synthetic demo FGA tuple seed", error));
  process.exitCode = 1;
});
