import { ScoredResult } from "./judge";
import * as fs from "fs";
import * as path from "path";

export function generateMarkdownReport(results: ScoredResult[]): string {
  const totalScore =
    results.reduce((sum, r) => sum + r.evaluation.total, 0) / results.length;
  const passCount = results.filter((r) => r.evaluation.verdict === "PASS").length;
  const failCount = results.filter((r) => r.evaluation.verdict === "FAIL").length;

  const avgSafety =
    results.reduce((sum, r) => sum + r.evaluation.safety.score, 0) /
    results.length;
  const avgSpecificity =
    results.reduce((sum, r) => sum + r.evaluation.specificity.score, 0) /
    results.length;
  const avgActionability =
    results.reduce((sum, r) => sum + r.evaluation.actionability.score, 0) /
    results.length;
  const avgClarity =
    results.reduce((sum, r) => sum + r.evaluation.clarity.score, 0) /
    results.length;

  const overallVerdict = totalScore >= 70 ? "PASS" : "FAIL";

  const safetyIssues = results
    .filter((r) => r.evaluation.safety.issues.length > 0)
    .map((r) => ({
      id: r.testId,
      query: r.query.slice(0, 50),
      issues: r.evaluation.safety.issues,
    }));

  const rows = results
    .map((r) => {
      const icon = r.evaluation.verdict === "PASS" ? "✅" : "❌";
      return `| ${icon} ${r.testId} | ${r.query.slice(0, 30)}... | ${r.evaluation.total} | ${r.evaluation.safety.score}/40 | ${r.evaluation.specificity.score}/25 | ${r.evaluation.actionability.score}/20 | ${r.evaluation.clarity.score}/15 | ${r.evaluation.summary.slice(0, 60)} |`;
    })
    .join("\n");

  return `# LawAI E2E 测试报告

> 生成时间: ${new Date().toLocaleString("zh-CN")}
> 测试用例: ${results.length} 个
> AI 模型: DeepSeek Chat (评估代理)

---

## 总览: ${overallVerdict} (${Math.round(totalScore)}/100)

| 指标 | 数值 |
|------|------|
| 通过 | ${passCount} |
| 失败 | ${failCount} |
| 平均分 | ${Math.round(totalScore)} |
| 平均安全性 | ${Math.round(avgSafety)}/40 |
| 平均针对性 | ${Math.round(avgSpecificity)}/25 |
| 平均可操作性 | ${Math.round(avgActionability)}/20 |
| 平均清晰度 | ${Math.round(avgClarity)}/15 |

---

## 安全问题

${
  safetyIssues.length === 0
    ? "✅ 无安全问题"
    : safetyIssues
        .map(
          (s) =>
            `- **Q${s.id}** (${s.query}): ${s.issues.join("; ")}`,
        )
        .join("\n")
}

---

## 逐题结果

| # | 问题 | 总分 | 安全 | 针对 | 操作 | 清晰 | 评价 |
|---|------|------|------|------|------|------|------|
${rows}

---

## 详细回复

${results
  .map(
    (r) => `
### Q${r.testId}: ${r.query}

**AI 回复**:
${r.response.slice(0, 500)}${r.response.length > 500 ? "..." : ""}

**评估**: ${r.evaluation.summary}
**得分**: ${r.evaluation.total}/100 (${r.evaluation.verdict})
`,
  )
  .join("\n---\n")}
`;
}

export function saveReport(results: ScoredResult[], outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const report = generateMarkdownReport(results);

  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const mdPath = path.join(outputDir, `report-${dateStr}.md`);
  fs.writeFileSync(mdPath, report, "utf-8");

  const jsonPath = path.join(outputDir, "results.json");
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf-8");

  console.log(`\nReport saved to: ${mdPath}`);
  console.log(`JSON results saved to: ${jsonPath}`);
}
