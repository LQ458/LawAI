import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { ZhipuAI } from "zhipuai-sdk-nodejs-v4";

// 定义AI响应的接口
interface AIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const mynamespace = pc
      .index("finalindex", process.env.HOST_ADD!)
      .namespace("caselist");
    const ai = new ZhipuAI({ apiKey: process.env.AI_API_KEY });
    const searchString = req.nextUrl.searchParams.get("search");
    if (!searchString) {
      return NextResponse.json(
        { error: "Search string is required" },
        { status: 400 },
      );
    }
    const myaiResponse = await ai.createEmbeddings({
      input: searchString,
      model: "embedding-3",
      encodingFormat: "float",
      user: "sfd",
      sensitiveWordCheck: {
        check: true,
        replace: true,
        replaceWith: "***",
      },
    });
    const queryResponse = await mynamespace.query({
      vector: myaiResponse.data[0].embedding,
      topK: 5,
      includeValues: true,
      includeMetadata: true,
    });
    const filteredMatches = queryResponse.matches.filter(
      (match) => (match?.score ?? 0) >= 0.3,
    );
    const recordDetails = filteredMatches.map((match) => ({
      title: match.metadata?.title,
      link: match.metadata?.link,
    }));
    const recordDetailsForAI = filteredMatches.map((match) => ({
      title: match.metadata?.title,
    }));
    const aiMessageContent = `以下是5个事例: ${recordDetailsForAI.map((detail) => `标题: ${detail.title}`).join(";")}。这是用户的问题: "${searchString}"。请在100字内解释这五个事例是如何解答用户的问题的`;
    console.log("aiMessageContent:" + aiMessageContent);
    const aiResponse = (await ai.createCompletions({
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
