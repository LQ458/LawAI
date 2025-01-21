import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import CaseModel from "@/models/data"; // Ensure you have a case model defined
import { ZhipuAI } from "zhipuai-sdk-nodejs-v4";
import nodejieba from "nodejieba";
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
    console.log(keywords)
    const keywords = nodejieba.cut(searchString, true);
    // Build the $or query with regex for each keyword
    const regexQueries = keywords.map((keyword) => ({
      $or: [
        { title: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { content: { $regex: keyword, $options: "i" } },
      ],
    }));

    const cases = await CaseModel.find({ $or: regexQueries }).limit(5);

    // Map only title and link, excluding description from the response
    const caseDetails = cases.map((c) => ({
      title: c.title,
      link: c.link, // Include only title and link in the response
    }));

    const ai = new ZhipuAI({ apiKey: process.env.AI_API_KEY! });
    const aiResponse = await ai.createCompletions({
      model: process.env.AI_MODEL || "glm-4-flashx",
      messages: [
        { role: "system", content: "请根据以上信息回答问题" },
        {
          role: "user",
          content: JSON.stringify({ searchString, caseDetails }),
        },
      ],
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
