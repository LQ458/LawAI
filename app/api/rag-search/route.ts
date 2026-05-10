import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { filterDocsByAccess } from "@/lib/docAccess";

export async function GET(req: NextRequest) {
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const searchString = req.nextUrl.searchParams.get("search");
    if (!searchString) {
      return NextResponse.json(
        { error: "Search string is required" },
        { status: 400 },
      );
    }

    const embeddingModel = process.env.PINECONE_EMBEDDING_MODEL || "multilingual-e5-large";
    const embeddings = await pc.inference.embed(
      embeddingModel,
      [searchString],
      { inputType: "query" },
    );

    const mynamespace = pc
      .index("finalindex", process.env.HOST_ADD!)
      .namespace("caselist");

    const queryEmbedding = embeddings.data[0];
    if (queryEmbedding.vectorType !== "dense" || !queryEmbedding.values) {
      return NextResponse.json(
        { error: "Failed to generate embedding" },
        { status: 500 },
      );
    }

    console.log(`[RAG] Embedding generated: ${queryEmbedding.values.length} dims, model=${embeddingModel}`);
    console.log(`[RAG] Search query length: ${searchString.length} chars`);

    const queryResponse = await mynamespace.query({
      vector: queryEmbedding.values,
      topK: 5,
      includeValues: false,
      includeMetadata: true,
    });

    console.log(`[RAG] Pinecone returned ${queryResponse.matches?.length || 0} matches`);
    if (queryResponse.matches?.length) {
      queryResponse.matches.forEach((m, i) => {
        console.log(`[RAG]   match ${i}: score=${m.score?.toFixed(4)}, title=${m.metadata?.title}`);
      });
    }

    const filteredMatches = queryResponse.matches.filter(
      (match) => (match?.score ?? 0) >= 0.3,
    );

    console.log(`[RAG] After score filter (>=0.3): ${filteredMatches.length} matches`);

    const candidateDocs = filteredMatches.map((match) => ({
      id: match.id,
      title: match.metadata?.title as string,
      link: match.metadata?.link as string,
      sensitivity: match.metadata?.sensitivity as string,
      department: match.metadata?.department as string,
    }));

    const userId = req.nextUrl.searchParams.get("userId") || "anonymous";

    const accessibleDocs = await filterDocsByAccess(candidateDocs, userId);

    if (accessibleDocs.length === 0) {
      return NextResponse.json({
        cases: [],
        data: "根据您的权限，未找到可访问的相关案例。",
        accessDenied: true,
      });
    }

    const recordDetailsForAI = accessibleDocs.map((doc) => ({
      title: doc.title,
    }));

    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY!,
    });

    const aiMessageContent = `以下是${accessibleDocs.length}个事例: ${recordDetailsForAI.map((detail) => `标题: ${detail.title}`).join(";")}。这是用户的问题: "${searchString}"。请在100字内解释这些事例是如何解答用户的问题的`;
    console.log("aiMessageContent:" + aiMessageContent);

    const aiResponse = await deepseek.chat.completions.create({
      model: process.env.AI_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: "请根据以下内容，" },
        { role: "user", content: aiMessageContent },
      ],
    });

    const aiMessage =
      aiResponse.choices?.[0]?.message?.content || "No response from AI";

    const recordDetails = accessibleDocs.map((doc) => ({
      title: doc.title,
      link: doc.link,
      id: doc.id,
    }));

    return NextResponse.json({
      cases: recordDetails,
      data: aiMessage,
      accessDenied: false,
    });
  } catch (error) {
    console.error("Error fetching cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 },
    );
  }
}
