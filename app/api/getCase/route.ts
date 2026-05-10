import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import OpenAI from "openai";

interface IRecord {
  title: string;
  link: string;
  description: string;
  content: string;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    await DBconnect();

    const searchString = req.nextUrl.searchParams.get("search");
    if (!searchString) {
      return NextResponse.json(
        { error: "Search string is required" },
        { status: 400 },
      );
    }

    const keywords = searchString.split("");
    const regexQueries = keywords.map((keyword: string) => ({
      $or: [
        { title: { $regex: escapeRegExp(keyword), $options: "i" } },
        { description: { $regex: escapeRegExp(keyword), $options: "i" } },
        { content: { $regex: escapeRegExp(keyword), $options: "i" } },
      ],
    }));

    const cases = await Record.find({ $or: regexQueries }).limit(5);

    const recordDetails = cases.map((r: IRecord) => ({
      title: r.title,
      link: r.link,
    }));
    const recordDetailsForAI = cases.map((c: IRecord) => ({
      title: c.title,
    }));

    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY!,
    });

    const aiMessageContent = `以下是5个事例: ${recordDetailsForAI.map((detail) => `标题: ${detail.title}`).join(";")}。这是用户的问题: "${searchString}"。请在100字内解释这五个事例是如何解答用户的问题的`;
    console.log("aiMessageContent:" + aiMessageContent);

    const aiResponse = await deepseek.chat.completions.create({
      model: process.env.AI_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: "请根据以下内容，" },
        { role: "user", content: aiMessageContent },
      ],
    });

    console.log("content:" + aiResponse.choices[0].message.content);
    const aiMessage =
      aiResponse.choices?.[0]?.message?.content || "No response from AI";
    return NextResponse.json({ cases: recordDetails, data: aiMessage });
  } catch (error) {
    console.error("Error fetching cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 },
    );
  }
}
