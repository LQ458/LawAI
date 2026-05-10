import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text to summarize is required" },
        { status: 400 },
      );
    }

    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY!,
    });

    const response = await deepseek.chat.completions.create({
      model: process.env.AI_MODEL || "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的文本总结助手。请用简洁的中文对以下文本进行总结，保留关键信息，控制在300字以内。",
        },
        { role: "user", content: text },
      ],
    });

    const summary =
      response.choices?.[0]?.message?.content || "Failed to summarize";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Error in summary API:", error);
    return NextResponse.json(
      { summary: "Failed to summarize" },
      { status: 500 },
    );
  }
}
