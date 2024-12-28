import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import CaseModel from "@/models/data"; // Import CaseModel from data.ts
import { ZhipuAI } from "zhipuai-sdk-nodejs-v4";

export async function GET(req: NextRequest) {
  try {
    await DBconnect();

    const searchString = req.nextUrl.searchParams.get('search');
    if (!searchString) {
      return NextResponse.json({ error: 'Search string is required' }, { status: 400 });
    }

    const cases = await CaseModel.find({
      $or: [
        { title: { $regex: searchString, $options: 'i' } },
        { description: { $regex: searchString, $options: 'i' } },
        { content: { $regex: searchString, $options: 'i' } }
      ]
    }).limit(5);

    const caseDetails = cases.map(c => ({
      title: c.title,
      description: c.description,
      content: c.content
    }));

    const ai = new ZhipuAI({ apiKey: process.env.AI_API_KEY! });
    const aiResponse = await ai.createCompletions({
      model: process.env.AI_MODEL || "glm-4-flashx",
      messages: [
        { role: "system", content: "请根据以上信息回答问题" },
        { role: "user", content: JSON.stringify({ searchString, caseDetails }) }
      ]
    });

    return NextResponse.json({ data: aiResponse, cases: caseDetails });
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
