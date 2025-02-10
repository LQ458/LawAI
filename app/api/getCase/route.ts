import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { ZhipuAI } from "zhipuai-sdk-nodejs-v4";

// 定义Record的接口
interface IRecord {
  title: string;
  link: string;
  description: string;
  content: string;
}

// 定义AI响应的接口
interface AIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Function to escape special characters in a string for use in a regular expression
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

    //const keywords = nodejieba.cut(searchString, true);
    // Build the $or query with regex for each keyword
    const keywords = searchString.split("");
    const regexQueries = keywords.map((keyword: string) => ({
      $or: [
        { title: { $regex: escapeRegExp(keyword), $options: "i" } },
        { description: { $regex: escapeRegExp(keyword), $options: "i" } },
        { content: { $regex: escapeRegExp(keyword), $options: "i" } },
      ],
    }));

    const cases = await Record.find({ $or: regexQueries }).limit(5);

    // Map only title and link, excluding description from the response
    const recordDetails = cases.map((r: IRecord) => ({
      title: r.title,
      link: r.link, // Include only title and link in the response
    }));
<<<<<<< HEAD
    const recordDetailsForAI = cases.map((c: { title: any; description: any; }) => ({
      title: c.title,
      description: c.description, // Include only title and description for the AI message
    }));

    const ai = new ZhipuAI({ apiKey: process.env.AI_API_KEY! });
    const aiMessageContent = `以下是5个事例: ${recordDetailsForAI.map(detail => `标题: ${detail.title}`).join(';')}。这是用户的问题: "${searchString}"。对于这五个例子，逐一在100字内解释这个事例是如何解答用户的问题的，记得换行`;    console.log("aiMessageContent:" + aiMessageContent);
    const aiResponse = await ai.createCompletions({
=======
    const recordDetailsForAI = cases.map((c: IRecord) => ({
      title: c.title, // Include only title for the AI message
    }));

    const ai = new ZhipuAI({ apiKey: process.env.AI_API_KEY! });
    const aiMessageContent = `以下是5个事例: ${recordDetailsForAI.map((detail) => `标题: ${detail.title}`).join(";")}。这是用户的问题: "${searchString}"。请在100字内解释这五个事例是如何解答用户的问题的`;
    console.log("aiMessageContent:" + aiMessageContent);
    const aiResponse = (await ai.createCompletions({
>>>>>>> 1e9c48992a06c8c7e17da35a819f231a6ec7d6b3
      model: process.env.AI_MODEL || "glm-4-flashx",
      messages: [
        { role: "system", content: "请根据以下内容，" },
        {
          role: "user",
          content: aiMessageContent,
        },
      ],
    })) as AIResponse;
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
