/**
 * Generate explicitly synthetic labor-law teaching examples.
 *
 * Generated text is never represented as a real judgment or verified fact.
 */

import OpenAI from "openai";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";
import { spawnSync } from "child_process";
import { createStableDocumentId } from "./lib/document-metadata";
import {
  assertDestructiveConfirmation,
  getArg,
  getIntegerArg,
  hasFlag,
  readCheckpoint,
  resolveCheckpointPath,
  safeFailureMessage,
  withRetry,
  writeCheckpoint,
} from "./lib/safe-cli";

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

const CATEGORIES = [
  {
    name: "work_injury",
    label: "工伤",
    topics: [
      "工地受伤",
      "工厂事故",
      "职业病",
      "交通事故工伤",
      "工伤认定",
      "工伤赔偿标准",
    ],
  },
  {
    name: "wage_dispute",
    label: "工资争议",
    topics: [
      "拖欠工资",
      "克扣工资",
      "最低工资",
      "加班工资",
      "年终奖争议",
      "农民工工资",
    ],
  },
  {
    name: "labor_contract",
    label: "劳动合同",
    topics: [
      "未签合同",
      "违法解除",
      "合同到期不续签",
      "试用期",
      "竞业限制",
      "无固定期限合同",
    ],
  },
  {
    name: "overtime",
    label: "加班费",
    topics: [
      "996工作制",
      "加班费计算",
      "节假日加班",
      "综合工时制",
      "加班证据",
      "加班费争议",
    ],
  },
  {
    name: "social_insurance",
    label: "社会保险",
    topics: [
      "未缴社保",
      "养老保险",
      "医疗保险",
      "工伤保险",
      "生育保险",
      "失业保险",
    ],
  },
  {
    name: "severance",
    label: "裁员补偿",
    topics: [
      "经济性裁员",
      "协商解除",
      "经济补偿金",
      "违法解除赔偿",
      "代通知金",
      "裁员程序",
    ],
  },
  {
    name: "wrongful_termination",
    label: "非法解雇",
    topics: [
      "孕期被辞退",
      "工伤期间被辞退",
      "试用期辞退",
      "报复性辞退",
      "歧视性辞退",
      "无理由辞退",
    ],
  },
  {
    name: "minimum_wage",
    label: "最低工资",
    topics: [
      "最低工资标准",
      "包吃住",
      "试用期工资",
      "病假工资",
      "停工工资",
      "实习工资",
    ],
  },
  {
    name: "probation",
    label: "试用期",
    topics: [
      "试用期时长",
      "试用期工资",
      "试用期社保",
      "试用期辞退",
      "延长试用期",
      "试用期转正",
    ],
  },
  {
    name: "annual_leave",
    label: "年假",
    topics: [
      "未休年假",
      "年假天数",
      "年假补偿",
      "带薪年假",
      "不休年假",
      "离职年假折算",
    ],
  },
  {
    name: "female_worker",
    label: "女职工保护",
    topics: ["产假", "哺乳期", "孕期保护", "生育津贴", "性别歧视", "三期保护"],
  },
  {
    name: "labor_arbitration",
    label: "劳动仲裁",
    topics: [
      "仲裁时效",
      "仲裁申请",
      "证据收集",
      "仲裁裁决执行",
      "劳动监察",
      "法律援助",
    ],
  },
] as const;

interface GeneratedCase {
  title: string;
  description: string;
  content: string;
  tags: string[];
  category: string;
}

interface GeneratorCheckpoint {
  schemaVersion: 1;
  version: string;
  nextIndex: number;
  written: number;
  destructiveCompleted?: boolean;
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/generate-labor-data.ts [options]

Options:
  --dry-run                    Plan only; no model, MongoDB, or Pinecone calls
  --count=N                    Total synthetic examples (default: 500)
  --batch-size=N               MongoDB write batch size (default: 25)
  --resume-from=N              Resume at zero-based example N
  --checkpoint=PATH            Resume from/write a checkpoint
  --version=VALUE              Synthetic dataset version (default: labor-synthetic-v1)
  --clear-mongo                Delete MongoDB records before generation
  --confirm-destructive        Required with --clear-mongo
  --backup-acknowledged        Required with --clear-mongo
  --pinecone                   Run non-destructive Pinecone upsert afterward
  --help                       Show this help
`);
}

function createClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey,
  });
}

async function generateCase(
  client: OpenAI,
  category: (typeof CATEGORIES)[number],
  topic: string,
): Promise<GeneratedCase> {
  const prompt = `请编写一个明确标注为虚构的中国劳动法合成教学示例。

类别：${category.label}
主题：${topic}

约束：
- 这不是裁判文书，也不来自真实案件。
- 人物、机构、日期、地点、金额和处理结果均须表述为虚构示例。
- 不得声称内容已被法院、仲裁机构或政府机关核实。

请严格按以下 JSON 格式返回（不要 markdown 代码块）：
{
  "title": "合成示例标题（15字以内）",
  "description": "虚构教学示例摘要（50字以内）",
  "content": "200-400字的虚构情境、争点、可供学习的法律规则和示例性分析；开头注明【合成教学示例，非真实裁判事实】",
  "tags": ["标签1", "标签2", "合成示例"]
}`;

  const response = await client.chat.completions.create({
    model: process.env.AI_MODEL || "deepseek-chat",
    messages: [
      {
        role: "system",
        content:
          "你编写虚构的法律教学示例。始终清楚说明内容是 synthetic example，不得冒充真实案件、裁判文书或经核实事实。",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  const raw = response.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(
      raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim(),
    ) as Record<string, unknown>;
    if (
      typeof parsed.title !== "string" ||
      parsed.title.trim().length === 0 ||
      typeof parsed.content !== "string" ||
      parsed.content.trim().length === 0
    ) {
      throw new Error("Synthetic data fields were missing");
    }
    return {
      title: parsed.title,
      description:
        typeof parsed.description === "string" ? parsed.description : "",
      content: parsed.content,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((tag): tag is string => typeof tag === "string")
            .slice(0, 5)
        : [category.label, "合成示例"],
      category: category.name,
    };
  } catch {
    throw new Error("Model response was not valid structured synthetic data");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const dryRun = hasFlag(args, "--dry-run");
  const clearMongo = hasFlag(args, "--clear-mongo");
  assertDestructiveConfirmation(args, clearMongo);
  const count = getIntegerArg(args, "--count", 500, { min: 0, max: 100_000 });
  const batchSize = getIntegerArg(args, "--batch-size", 25, {
    min: 1,
    max: 500,
  });
  const version = getArg(args, "--version") || "labor-synthetic-v1";
  const explicitResume = args.some(
    (arg) => arg === "--resume-from" || arg.startsWith("--resume-from="),
  );
  const resumeFrom = getIntegerArg(args, "--resume-from", 0, {
    min: 0,
    max: count,
  });
  const explicitCheckpoint = args.some(
    (arg) => arg === "--checkpoint" || arg.startsWith("--checkpoint="),
  );
  const checkpointPath = resolveCheckpointPath(
    args,
    "generate-labor-data.json",
  );
  const checkpoint = explicitCheckpoint
    ? readCheckpoint<GeneratorCheckpoint>(checkpointPath)
    : undefined;
  if (checkpoint && checkpoint.version !== version) {
    throw new Error("Checkpoint version does not match --version");
  }

  const startIndex = explicitResume ? resumeFrom : checkpoint?.nextIndex || 0;

  console.log("Synthetic labor-data generation");
  console.log(`Mode: ${dryRun ? "dry-run" : "generate and MongoDB upsert"}`);
  console.log(`Target count: ${count}`);
  console.log(`Start index: ${startIndex}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Source kind: synthetic; visibility: public`);

  if (dryRun) {
    console.log("External calls=0; writes=0; document text output=0.");
    return;
  }

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL is not configured");
  const client = createClient();
  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 60_000,
    connectTimeoutMS: 60_000,
  });

  try {
    const collection = mongoose.connection.collection("records");
    const destructiveAlreadyCompleted =
      Boolean(checkpoint?.destructiveCompleted) && !explicitResume;
    if (clearMongo && !destructiveAlreadyCompleted) {
      await withRetry(() => collection.deleteMany({}));
      writeCheckpoint<GeneratorCheckpoint>(checkpointPath, {
        schemaVersion: 1,
        version,
        nextIndex: 0,
        written: 0,
        destructiveCompleted: true,
      });
      console.log("Confirmed MongoDB clear completed.");
    }

    const pending: Array<{ index: number; document: Record<string, unknown> }> =
      [];
    let written = explicitResume ? 0 : checkpoint?.written || 0;

    const flush = async (): Promise<void> => {
      if (pending.length === 0) return;
      const batch = pending.splice(0);
      await withRetry(
        () =>
          collection.bulkWrite(
            batch.map(({ document }) => ({
              updateOne: {
                filter: { documentId: document.documentId },
                update: {
                  $set: document,
                  $setOnInsert: { createdAt: new Date() },
                },
                upsert: true,
              },
            })),
            { ordered: false },
          ),
        {
          onRetry: (attempt) =>
            console.warn(
              `MongoDB batch retry ${attempt}/3; record data omitted.`,
            ),
        },
      );
      written += batch.length;
      writeCheckpoint<GeneratorCheckpoint>(checkpointPath, {
        schemaVersion: 1,
        version,
        nextIndex: batch[batch.length - 1].index + 1,
        written,
        destructiveCompleted:
          clearMongo || checkpoint?.destructiveCompleted || false,
      });
    };

    for (let index = startIndex; index < count; index++) {
      const category = CATEGORIES[index % CATEGORIES.length];
      const topicIndex =
        Math.floor(index / CATEGORIES.length) % category.topics.length;
      const topic = category.topics[topicIndex];
      const generated = await withRetry(
        () => generateCase(client, category, topic),
        {
          attempts: 3,
          baseDelayMs: 1000,
          onRetry: (attempt) =>
            console.warn(
              `Generation retry ${attempt}/3; model output omitted.`,
            ),
        },
      );
      const documentId = createStableDocumentId(
        "lawai-synthetic-labor",
        `${version}:${index}`,
      );
      const disclaimer =
        "【合成教学示例，非真实裁判事实】人物、机构、日期、地点、金额及处理结果均为虚构，仅用于学习。";
      pending.push({
        index,
        document: {
          documentId,
          visibility: "public",
          sensitivity: "public",
          source: "LawAI synthetic labor generator",
          sourceKind: "synthetic",
          sourceUrl: `synthetic://lawai/labor-generator/${version}`,
          version,
          needsReview: false,
          syntheticMetric: true,
          title: `[合成示例] ${generated.title}`,
          link: `synthetic://lawai/labor-example/${documentId}`,
          description: `${disclaimer}${generated.description}`,
          content: `${disclaimer}\n${generated.content}`,
          date: "synthetic-example",
          tags: Array.from(new Set([...generated.tags, "合成示例"])),
          category: generated.category,
          views: 0,
          likes: 0,
          bookmarks: 0,
          interactionScore: 0,
          lastUpdateTime: new Date(),
          updatedAt: new Date(),
        },
      });

      if (pending.length >= batchSize) {
        await flush();
        console.log(`Progress: written=${written}/${count}.`);
      }
    }
    await flush();
    console.log(`Complete: written=${written}.`);
  } finally {
    await mongoose.disconnect();
  }

  if (hasFlag(args, "--pinecone")) {
    const child = spawnSync(
      "npx",
      [
        "tsx",
        "scripts/ingest-pinecone.ts",
        `--batch-size=${Math.min(batchSize, 96)}`,
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
      },
    );
    if (child.status !== 0) throw new Error("Pinecone follow-up failed");
  }
}

main().catch((error) => {
  console.error(safeFailureMessage("Synthetic labor-data generation", error));
  process.exitCode = 1;
});
