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
    console.log("📥 AI request received");
    const { username, chatId, message } = await req.json();
    console.log("📝 Request data:", { username, chatId: !!chatId, messageLength: message?.length });
    
    let sessionId = chatId;
    let chat;
    let newChatCreated = false; // 添加标记

    console.log("🔌 Connecting to database...");
    await DBconnect();
    console.log("✅ Database connected");

    if (!username || !message) {
      console.log("❌ Missing username or message");
      return NextResponse.json(
        { error: "Username and message are required" },
        { status: 400 },
      );
    }

    // 查找用户 - 支持多种查找方式
    let user;
    if (username) {
      // 先尝试用户名查找，然后尝试姓名查找
      user = await User.findOne({
        $or: [
          { username: username },
          { name: username }
        ]
      });
    }
    
    if (!user) {
      return NextResponse.json({ 
        error: "User not found", 
        debug: { username, searchAttempted: true } 
      }, { status: 404 });
    }

    // 如果没有 chatId，创建新的聊天
    if (!chatId) {
      try {
        // 先检查是否已经存在相同标题的未完成聊天
        const existingChat = await Chat.findOne({
          userId: user._id,
          title: message.substring(0, 20) + (message.length > 20 ? "..." : ""),
          "messages.length": 2, // 只有两条消息的聊天 (系统提示 + 用户消息)
        });

        if (existingChat) {
          chat = existingChat;
          sessionId = existingChat._id.toString();
        } else {
          chat = new Chat({
            title:
              message.substring(0, 20) + (message.length > 20 ? "..." : ""),
            userId: user._id,
            time: getCurrentTimeInLocalTimeZone(),
            messages: [
              {
                role: "system",
                content:
                  "您正在为一位农民工提供法律帮助。在回答任何问题之前,请确保首先请求用户提供所有必要的具体信息,以便提供精准、个性化的法律建议。例如,如果用户遇到工伤问题,请询问以下详细信息:工伤发生的时间、地点、受伤部位、医疗费用以及雇主信息等。如果是工资争议,请询问工资支付的具体情况、合同是否存在以及任何相关证据。请避免给出一般性或模糊的建议,确保提供与用户情况完全相关的指导。请在开始提供答案时,结合用户提供的具体信息,给出详细的操作步骤,并尽可能提供实际的联系方式和地点等信息。确保每次提供的答案都是用户可以立刻行动并且符合他们法律需求的。",
              },
              { role: "user", content: message, timestamp: new Date() },
            ],
          });
          await chat.save();
          sessionId = chat._id.toString();
          newChatCreated = true;
        }
      } catch (error) {
        console.error("Error creating new chat:", error);
        throw error;
      }
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
    console.log("🤖 Starting AI request...");
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log("🔑 AI API Key exists:", !!process.env.AI_API_KEY);
          console.log("🎯 AI Model:", process.env.AI_MODEL || "glm-4-flashx");
          
          const ai = new ZhipuAI({ apiKey: process.env.AI_API_KEY! });
          console.log("💬 Sending message to AI...");
          
          const result = await ai.createCompletions({
            model: process.env.AI_MODEL || "glm-4-flashx",
            messages: chat.messages as MessageOptions[],
            stream: true,
          });
          
          console.log("✅ AI response stream created");

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
                    // 确保发送的内容是完整的 markdown 块
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({ content: aiResponse })}\n\n`,
                      ),
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
          // 如果是新创建的聊天且发生错误，删除整个聊天
          if (newChatCreated) {
            try {
              await Chat.findByIdAndDelete(chat._id);
              console.log("Deleted new chat due to error:", chat._id);
            } catch (deleteError) {
              console.error("Error deleting chat:", deleteError);
            }
          } else if (chat && chat.messages.length > 1) {
            // 如果是现有聊天，只删除最后一条消息
            chat.messages.pop();
            chat.time = getCurrentTimeInLocalTimeZone();
            await chat.save();
            console.log("Removed last message from chat:", chat._id);
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
