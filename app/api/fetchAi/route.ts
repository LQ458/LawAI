// AI 服务的请求和调取会话逻辑
import { NextResponse, NextRequest } from "next/server";
import Chat from "@/models/chat"; // 确保路径正确
import DBconnect from "@/lib/mongodb";
import User from "@/models/user";
import { ZhipuAI } from "zhipuai-sdk-nodejs-v4";
import { MessageOptions } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";

export async function POST(req: NextRequest) {
  try {
    const { username, chatId, message } = await req.json();
    let sessionId = chatId;
    console.log("---chatId---", sessionId);
    await DBconnect();

    if (!username || !message) {
      return NextResponse.json(
        { error: "Username and message are required" },
        { status: 400 },
      );
    }

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let chat;

    // 如果没有 chatId，创建新的聊天
    if (!chatId) {
      chat = new Chat({
        title: message.substring(0, 20) + (message.length > 20 ? "..." : ""),
        userId: user._id,
        time: getCurrentTimeInLocalTimeZone(),
        messages: [{ role: "user", content: message, timestamp: new Date() }],
      });
      await chat.save();
      sessionId = chat._id.toString();
    } else {
      chat = await Chat.findById(sessionId);
      if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }
      // 添加用户消息到现有聊天
      chat.messages.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });
      await chat.save();
    }

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const ai = new ZhipuAI({ apiKey: process.env.AI_API_KEY! });
          const result = await ai.createCompletions({
            model: process.env.AI_MODEL || "glm-4-flashx",
            messages: chat.messages as MessageOptions[],
            stream: true,
          });

          let aiResponse = "";

          for await (const chunk of result as AsyncIterable<Buffer>) {
            const chunkString = chunk.toString("utf-8");
            const lines = chunkString.split("\n");

            for (const line of lines) {
              if (line.trim().startsWith("data: ")) {
                const jsonStr = line.trim().slice(6);
                if (jsonStr === "[DONE]") continue;

                try {
                  const chunkJson = JSON.parse(jsonStr);
                  const content = chunkJson.choices?.[0]?.delta?.content;
                  if (content) {
                    aiResponse += content;
                    // 只发送实际内容
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${content}\n\n`),
                    );
                  }
                } catch (jsonError) {
                  console.warn("Invalid JSON chunk:", jsonStr, jsonError);
                }
              }
            }
          }

          // 保存完整的 AI 响应到数据库
          if (aiResponse) {
            chat.messages.push({
              role: "assistant",
              content: aiResponse,
              timestamp: new Date(),
            });
            chat.time = getCurrentTimeInLocalTimeZone();
            await chat.save();
          }

          // 直接关闭流，不发送完成信号
          controller.close();
        } catch (error) {
          console.error("Stream processing error:", error);
          if (chat && chat.messages.length > 0) {
            chat.messages.pop(); // 删除最后一条消息
            chat.time = getCurrentTimeInLocalTimeZone();
            await chat.save();
            console.log(
              "Successfully removed last message from chat:",
              chat._id,
            );
          }
          controller.error(error);
        }
      },
    });

    // 返回流式响应
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Session-Id": sessionId,
        "X-Chat-Title": encodeURIComponent(chat.title),
      },
    });
  } catch (error) {
    console.error("Error in fetchAi:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
