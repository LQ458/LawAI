import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readJsonObject, cleanBoundedString } from "@/lib/request";
import { getServerIdentity } from "@/lib/serverAuth";
import { consumeRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 85_000;
const MAX_SUMMARY_INPUT_LENGTH = 20_000;
const DEEPSEEK_TIMEOUT_MS = 30_000;

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "APIConnectionTimeoutError" ||
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("timeout"))
  );
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getServerIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await consumeRateLimit("summary", req, identity.subject))) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const body = await readJsonObject(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const input = cleanBoundedString(body.value.text, {
      max: MAX_SUMMARY_INPUT_LENGTH,
    });
    if (!input) {
      return NextResponse.json(
        {
          error: `Text must be between 1 and ${MAX_SUMMARY_INPUT_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Summary service is unavailable" },
        { status: 503 },
      );
    }

    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey,
      timeout: DEEPSEEK_TIMEOUT_MS,
      maxRetries: 0,
    });

    let response;
    try {
      response = await deepseek.chat.completions.create({
        model: process.env.AI_MODEL || "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "你是文本总结助手。请用简洁的中文总结用户提供的文本，保留关键信息，控制在300字以内。不要把总结表述为法律意见。",
          },
          { role: "user", content: input },
        ],
        max_tokens: 600,
      });
    } catch (error) {
      const timedOut = isTimeoutError(error);
      console.error(
        timedOut
          ? "DeepSeek summary request timed out"
          : "DeepSeek summary request failed",
      );
      return NextResponse.json(
        {
          error: timedOut
            ? "Summary service timed out"
            : "Summary service is unavailable",
        },
        { status: timedOut ? 504 : 502 },
      );
    }

    const summary = response.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      return NextResponse.json(
        { error: "Summary service returned no content" },
        { status: 502 },
      );
    }

    return NextResponse.json({ summary });
  } catch {
    console.error("Summary request failed");
    return NextResponse.json({ error: "Failed to summarize" }, { status: 500 });
  }
}
