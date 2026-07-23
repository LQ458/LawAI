import { evaluateResponses, JudgeInput } from "../evaluator/judge";
import { saveReport } from "../evaluator/reporter";
import { TEST_CASES } from "../evaluator/test-cases";
import {
  EVALUATION_DATASET_VERSION,
  JUDGE_PROMPT_VERSION,
  RUBRIC_VERSION,
} from "../evaluator/rubric";
import * as path from "path";

async function run() {
  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY not set in environment");
    process.exit(1);
  }
  if (process.env.RUN_EXTERNAL_EVALUATION !== "1") {
    console.error(
      "External evaluation is disabled. Set RUN_EXTERNAL_EVALUATION=1 explicitly.",
    );
    process.exit(1);
  }
  const AUTH_COOKIE = process.env.EVALUATION_AUTH_COOKIE;
  if (!AUTH_COOKIE) {
    console.error("EVALUATION_AUTH_COOKIE is required for the optional suite.");
    process.exit(1);
  }

  const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
  const answerModel = process.env.AI_MODEL || "deepseek-chat";
  const judgeModel = process.env.EVALUATION_MODEL || "deepseek-chat";

  console.log("=== LawAI AI Chat Evaluation ===\n");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Test cases: ${TEST_CASES.length}\n`);

  const inputs: JudgeInput[] = [];

  for (const tc of TEST_CASES) {
    console.log(`[${tc.id}/${TEST_CASES.length}] Sending curated test case`);

    try {
      const res = await fetch(`${BASE_URL}/api/fetchAi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: AUTH_COOKIE,
        },
        body: JSON.stringify({
          chatId: "",
          message: tc.query,
        }),
      });

      if (!res.ok) {
        console.error(`  API error: ${res.status}`);
        inputs.push({
          ...tc,
          testId: tc.id,
          response: `API_ERROR:${res.status}`,
        });
        continue;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullResponse = data.content;
              }
            } catch {
              // skip
            }
          }
        }
      }

      console.log("  Response received");
      inputs.push({
        ...tc,
        testId: tc.id,
        response: fullResponse,
      });
    } catch {
      console.error("  Curated test request failed");
      inputs.push({
        ...tc,
        testId: tc.id,
        response: "REQUEST_ERROR",
      });
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n=== AI Evaluation Phase ===\n");
  const results = await evaluateResponses(inputs, API_KEY, judgeModel);

  const outputDir = path.join(__dirname, "output");
  saveReport(results, outputDir, {
    runAt: new Date().toISOString(),
    answerModel,
    judgeModel,
    promptVersion: JUDGE_PROMPT_VERSION,
    rubricVersion: RUBRIC_VERSION,
    datasetVersion: EVALUATION_DATASET_VERSION,
  });

  const avgScore =
    results.reduce((sum, r) => sum + r.evaluation.total, 0) / results.length;
  const passCount = results.filter(
    (r) => r.evaluation.verdict === "PASS",
  ).length;

  console.log(`\n=== Results ===`);
  console.log(`Average score: ${Math.round(avgScore)}/100`);
  console.log(`Passed: ${passCount}/${results.length}`);
  console.log(`Report: ${path.join(outputDir, "results.json")}`);

  if (avgScore < 70) {
    process.exit(1);
  }
}

run().catch(console.error);
