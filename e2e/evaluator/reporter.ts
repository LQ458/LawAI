import { ScoredResult } from "./judge";
import * as fs from "fs";
import * as path from "path";

export interface EvaluationReportMetadata {
  runAt: string;
  answerModel: string;
  judgeModel: string;
  promptVersion: string;
  rubricVersion: string;
  datasetVersion: string;
}

function averages(results: ScoredResult[]) {
  const divisor = results.length || 1;
  return {
    total:
      results.reduce((sum, result) => sum + result.evaluation.total, 0) /
      divisor,
    safety:
      results.reduce((sum, result) => sum + result.evaluation.safety.score, 0) /
      divisor,
    specificity:
      results.reduce(
        (sum, result) => sum + result.evaluation.specificity.score,
        0,
      ) / divisor,
    actionability:
      results.reduce(
        (sum, result) => sum + result.evaluation.actionability.score,
        0,
      ) / divisor,
    clarity:
      results.reduce(
        (sum, result) => sum + result.evaluation.clarity.score,
        0,
      ) / divisor,
  };
}

export function generateMarkdownReport(
  results: ScoredResult[],
  metadata: EvaluationReportMetadata,
): string {
  const average = averages(results);
  const passCount = results.filter(
    (result) => result.evaluation.verdict === "PASS",
  ).length;
  const rows = results
    .map(
      (result) =>
        `| ${result.testId} | ${result.category} | ${result.evaluation.total} | ${result.evaluation.safety.score}/40 | ${result.evaluation.specificity.score}/25 | ${result.evaluation.actionability.score}/20 | ${result.evaluation.clarity.score}/15 | ${result.evaluation.verdict} |`,
    )
    .join("\n");

  return `# LawAI automated evaluation report

> This is an automated LLM-judge evaluation of 12 curated legal-information
> test queries. It is not a lawyer review or a professional legal-accuracy
> validation. Raw prompts and responses are intentionally omitted.

| Run metadata | Value |
|---|---|
| Date (UTC) | ${metadata.runAt} |
| Answer model | ${metadata.answerModel} |
| Judge model | ${metadata.judgeModel} |
| Prompt version | ${metadata.promptVersion} |
| Rubric version | ${metadata.rubricVersion} |
| Dataset version | ${metadata.datasetVersion} |

## Summary

| Metric | Result |
|---|---:|
| Curated queries evaluated | ${results.length} |
| Passing items | ${passCount} |
| Average total | ${Math.round(average.total)}/100 |
| Average safety | ${Math.round(average.safety)}/40 |
| Average specificity | ${Math.round(average.specificity)}/25 |
| Average actionability | ${Math.round(average.actionability)}/20 |
| Average clarity | ${Math.round(average.clarity)}/15 |

## Per-item results

| ID | Category | Total | Safety | Specificity | Actionability | Clarity | Automated verdict |
|---:|---|---:|---:|---:|---:|---:|---|
${rows}
`;
}

function sanitizedResults(results: ScoredResult[]) {
  return results.map((result) => ({
    testId: result.testId,
    category: result.category,
    timestamp: result.timestamp,
    evaluation: result.evaluation,
  }));
}

export function saveReport(
  results: ScoredResult[],
  outputDir: string,
  metadata: EvaluationReportMetadata,
): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const report = generateMarkdownReport(results, metadata);
  const dateStr = metadata.runAt.replace(/[:.]/g, "-").slice(0, 19);
  const mdPath = path.join(outputDir, `report-${dateStr}.md`);
  fs.writeFileSync(mdPath, report, "utf-8");

  const jsonPath = path.join(outputDir, "results.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ metadata, results: sanitizedResults(results) }, null, 2),
    "utf-8",
  );

  console.log(`Report saved under ${outputDir}`);
}
