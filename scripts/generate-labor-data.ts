/**
 * Generate Labor Law Dataset via DeepSeek
 *
 * Uses DeepSeek to generate realistic Chinese labor law case descriptions,
 * then loads them into MongoDB and ingests into Pinecone.
 *
 * Each case includes: title, description, content, tags, category
 *
 * Usage:
 *   npx tsx scripts/generate-labor-data.ts --count=500
 */

import OpenAI from "openai";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";
import { execSync } from "child_process";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const args = process.argv.slice(2);
const count = parseInt(args.find((a) => a.startsWith("--count="))?.split("=")[1] || "500");

const CATEGORIES = [
  { name: "work_injury", label: "工伤", topics: ["工地受伤", "工厂事故", "职业病", "交通事故工伤", "工伤认定", "工伤赔偿标准"] },
  { name: "wage_dispute", label: "工资争议", topics: ["拖欠工资", "克扣工资", "最低工资", "加班工资", "年终奖争议", "农民工工资"] },
  { name: "labor_contract", label: "劳动合同", topics: ["未签合同", "违法解除", "合同到期不续签", "试用期", "竞业限制", "无固定期限合同"] },
  { name: "overtime", label: "加班费", topics: ["996工作制", "加班费计算", "节假日加班", "综合工时制", "加班证据", "加班费争议"] },
  { name: "social_insurance", label: "社会保险", topics: ["未缴社保", "养老保险", "医疗保险", "工伤保险", "生育保险", "失业保险"] },
  { name: "severance", label: "裁员补偿", topics: ["经济性裁员", "协商解除", "经济补偿金", "违法解除赔偿", "代通知金", "裁员程序"] },
  { name: "wrongful_termination", label: "非法解雇", topics: ["孕期被辞退", "工伤期间被辞退", "试用期辞退", "报复性辞退", "歧视性辞退", "无理由辞退"] },
  { name: "minimum_wage", label: "最低工资", topics: ["最低工资标准", "包吃住", "试用期工资", "病假工资", "停工工资", "实习工资"] },
  { name: "probation", label: "试用期", topics: ["试用期时长", "试用期工资", "试用期社保", "试用期辞退", "延长试用期", "试用期转正"] },
  { name: "annual_leave", label: "年假", topics: ["未休年假", "年假天数", "年假补偿", "带薪年假", "不休年假", "离职年假折算"] },
  { name: "female_worker", label: "女职工保护", topics: ["产假", "哺乳期", "孕期保护", "生育津贴", "性别歧视", "三期保护"] },
  { name: "labor_arbitration", label: "劳动仲裁", topics: ["仲裁时效", "仲裁申请", "证据收集", "仲裁裁决执行", "劳动监察", "法律援助"] },
];

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY!,
});

async function generateCase(category: (typeof CATEGORIES)[0]): Promise<{
  title: string;
  description: string;
  content: string;
  tags: string[];
  category: string;
}> {
  const topic = category.topics[Math.floor(Math.random() * category.topics.length)];

  const prompt = `请生成一个真实的中国劳动法案例，要求：

类别：${category.label}
主题：${topic}

请严格按以下JSON格式返回（不要markdown代码块）：
{
  "title": "案例标题（15字以内，如：建筑工人工伤认定纠纷案）",
  "description": "案例简要描述（50字以内，概括案情和结果）",
  "content": "案例详细内容（200-400字，包括：案发时间地点、当事人基本情况、争议焦点、法律依据、处理结果。要像真实裁判文书风格，包含具体的法律条款引用、金额数字、地名等细节）",
  "tags": ["标签1", "标签2", "标签3"]
}`;

  const resp = await deepseek.chat.completions.create({
    model: process.env.AI_MODEL || "deepseek-chat",
    messages: [
      { role: "system", content: "你是一个中国劳动法专家，擅长编写真实的法律案例文书。请生成多样化、高质量的中国劳动法案例。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
  });

  const raw = resp.choices?.[0]?.message?.content || "";
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || `${topic}案例`,
      description: parsed.description || "",
      content: parsed.content || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [category.label],
      category: category.name,
    };
  } catch {
    // If JSON parsing fails, return a fallback
    return {
      title: `${topic}典型案例`,
      description: raw.slice(0, 100),
      content: raw,
      tags: [category.label],
      category: category.name,
    };
  }
}

async function main() {
  console.log(`=== Generating ${count} Labor Law Cases ===\n`);

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL not set");

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 60000, connectTimeoutMS: 60000 });
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;
  const collection = db.collection("records");

  // Clear existing records to replace with labor law data
  await collection.deleteMany({});
  console.log("Cleared existing records.\n");

  let generated = 0;
  const batch: any[] = [];

  while (generated < count) {
    const category = CATEGORIES[generated % CATEGORIES.length];
    try {
      const c = await generateCase(category);
      const doc = {
        title: c.title,
        link: "",
        description: c.description,
        content: c.content,
        date: `2024`,
        tags: c.tags,
        category: c.category,
        views: Math.floor(Math.random() * 500),
        likes: Math.floor(Math.random() * 50),
        bookmarks: Math.floor(Math.random() * 20),
        interactionScore: Math.floor(Math.random() * 100),
        lastUpdateTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      batch.push(doc);
      generated++;

      if (generated % 10 === 0) {
        process.stdout.write(`\r  Generated ${generated}/${count} [${c.title.slice(0, 30)}]`);
      }

      if (batch.length >= 50) {
        await collection.insertMany(batch, { ordered: false }).catch(() => {});
        batch.length = 0;
      }
    } catch (err) {
      console.error(`\n  Error at ${generated}:`, err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: false }).catch(() => {});
  }

  console.log(`\n\nInserted ${generated} labor law cases into MongoDB.`);
  await mongoose.disconnect();

  console.log("\n=== Starting Pinecone Ingestion ===\n");
  execSync(`npx tsx scripts/ingest-pinecone.ts --clear`, {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    timeout: 600_000,
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
