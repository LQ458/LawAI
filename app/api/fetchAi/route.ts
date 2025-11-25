// AI 服务的请求和调取会话逻辑 (支持已登录用户和临时用户)
import { NextResponse, NextRequest } from "next/server";
import Chat from "@/models/chat";
import QueryLog from "@/models/queryLog";
import DBconnect from "@/lib/mongodb";
import User from "@/models/user";
import { ZhipuAI } from "zhipuai-sdk-nodejs-v4";
import { MessageOptions, Message } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { getUserIdentityFromBody } from "@/lib/authUtils";
import { Document } from "mongoose";

// 定义临时聊天类型
interface TempChat {
  _id: string;
  title: string;
  guestId?: string;
  time: string;
  messages: Message[];
}

export async function POST(req: NextRequest) {
  try {
    console.log("📥 AI request received");
    const body = await req.json();
    const { username, chatId, message, guestId } = body;
    console.log("📝 Request data:", { 
      username, 
      guestId,
      chatId: !!chatId, 
      messageLength: message?.length 
    });
    
    let sessionId = chatId;
    let chat: TempChat | (Document & { messages: Message[] }) | null = null; // 明确类型
    let newChatCreated = false;
    let isGuestMode = false;

    // 获取用户身份 (已登录或临时用户)
    const identity = await getUserIdentityFromBody(req, body, true);
    
    if (!identity) {
      console.log("❌ No user identity found");
      return NextResponse.json(
        { error: "User identity required" },
        { status: 400 },
      );
    }

    isGuestMode = identity.isGuest;
    console.log(`👤 User mode: ${isGuestMode ? 'Guest' : 'Authenticated'}, ID: ${identity.identifier}`);

    if (!message) {
      console.log("❌ Missing message");
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // 临时用户模式 - 不使用数据库,数据保存在前端
    if (isGuestMode) {
      // 临时用户的聊天数据完全由前端管理
      // API只负责调用AI并返回响应
      console.log("🔓 Guest mode: Chat data managed by frontend");
      
      // 如果提供了chatId,说明是现有对话
      // 否则是新对话,前端会生成ID
      const tempChat: TempChat = {
        _id: chatId || `guest_chat_${Date.now()}`,
        title: message.substring(0, 20) + (message.length > 20 ? "..." : ""),
        guestId: identity.guestId,
        time: getCurrentTimeInLocalTimeZone(),
        messages: [
          {
            role: "system" as const,
            content:
              "您正在为一位农民工提供法律帮助。在回答任何问题之前,请确保首先请求用户提供所有必要的具体信息,以便提供精准、个性化的法律建议。例如,如果用户遇到工伤问题,请询问以下详细信息:工伤发生的时间、地点、受伤部位、医疗费用以及雇主信息等。如果是工资争议,请询问工资支付的具体情况、合同是否存在以及任何相关证据。请避免给出一般性或模糊的建议,确保提供与用户情况完全相关的指导。请在开始提供答案时,结合用户提供的具体信息,给出详细的操作步骤,并尽可能提供实际的联系方式和地点等信息。确保每次提供的答案都是用户可以立刻行动并且符合他们法律需求的。",
            timestamp: new Date(),
          },
          { role: "user" as const, content: message, timestamp: new Date() },
        ],
      };
      
      sessionId = tempChat._id;
      chat = tempChat;
      
    } else {
      // 已登录用户模式 - 使用数据库
      console.log("🔌 Connecting to database...");
      await DBconnect();
      console.log("✅ Database connected");

      // 查找用户 - 支持多种查找方式
      let user;
      if (username) {
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
            "messages.length": 2,
          });

          if (existingChat) {
            chat = existingChat;
            sessionId = existingChat._id.toString();
          } else {
            const newChat = new Chat({
              title:
                message.substring(0, 20) + (message.length > 20 ? "..." : ""),
              userId: user._id,
              time: getCurrentTimeInLocalTimeZone(),
              messages: [
                {
                  role: "system" as const,
                  content:
                    "您正在为一位农民工提供法律帮助。在回答任何问题之前,请确保首先请求用户提供所有必要的具体信息,以便提供精准、个性化的法律建议。例如,如果用户遇到工伤问题,请询问以下详细信息:工伤发生的时间、地点、受伤部位、医疗费用以及雇主信息等。如果是工资争议,请询问工资支付的具体情况、合同是否存在以及任何相关证据。请避免给出一般性或模糊的建议,确保提供与用户情况完全相关的指导。请在开始提供答案时,结合用户提供的具体信息,给出详细的操作步骤,并尽可能提供实际的联系方式和地点等信息。确保每次提供的答案都是用户可以立刻行动并且符合他们法律需求的。",
                  timestamp: new Date(),
                },
                { role: "user" as const, content: message, timestamp: new Date() },
              ],
            });
            await newChat.save();
            chat = newChat;
            sessionId = newChat._id.toString();
            newChatCreated = true;
          }
        } catch (error) {
          console.error("Error creating new chat:", error);
          throw error;
        }
      } else {
        const existingChat = await Chat.findById(sessionId);
        if (!existingChat) {
          return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }
        // 添加用户消息到现有聊天
        existingChat.messages.push({
          role: "user" as const,
          content: message,
          timestamp: new Date(),
        });
        await existingChat.save();
        chat = existingChat;
      }
    }
    // 记录查询日志 (用于统计)
    try {
      // 确保数据库连接 (Guest模式下可能还没连接)
      if (isGuestMode) {
        await DBconnect();
      }
      
      await QueryLog.create({
        userId: isGuestMode ? identity.guestId : identity.identifier,
        isGuest: isGuestMode,
        timestamp: new Date()
      });
      console.log("📊 Query logged for stats");
    } catch (logError) {
      console.error("Failed to log query:", logError);
      // 不中断主流程
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

          // 保存完整的 AI 响应
          if (aiResponse) {
            const assistantMessage = {
              role: "assistant" as const,
              content: aiResponse,
              timestamp: new Date(),
            };
            
            // 临时用户模式 - 通过响应头返回完整聊天数据供前端保存
            if (isGuestMode) {
              chat.messages.push(assistantMessage);
              (chat as TempChat).time = getCurrentTimeInLocalTimeZone();
              // 将完整的chat对象编码到响应头中
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ 
                    content: aiResponse,
                    chatData: chat,
                    isGuest: true
                  })}\n\n`,
                ),
              );
            } else {
              // 已登录用户 - 保存到数据库
              if ('save' in chat && typeof chat.save === 'function') {
                chat.messages.push(assistantMessage);
                (chat as unknown as Document & { time: string }).time = getCurrentTimeInLocalTimeZone();
                await chat.save();
              }
            }
          }

          // 直接关闭流，不发送完成信号
          controller.close();
        } catch (error) {
          console.error("Stream processing error:", error);
          
          // 只有已登录用户且创建了新聊天时才删除数据库记录
          if (!isGuestMode && 'save' in chat) {
            if (newChatCreated) {
              try {
                await Chat.findByIdAndDelete((chat as Document & { _id: unknown })._id);
                console.log("Deleted new chat due to error:", (chat as Document & { _id: unknown })._id);
              } catch (deleteError) {
                console.error("Error deleting chat:", deleteError);
              }
            } else if (chat && chat.messages.length > 1) {
              // 如果是现有聊天,只删除最后一条消息
              chat.messages.pop();
              (chat as unknown as Document & { time: string }).time = getCurrentTimeInLocalTimeZone();
              if (typeof chat.save === 'function') {
                await chat.save();
              }
              console.log("Removed last message from chat:", (chat as Document & { _id: unknown })._id);
            }
          }
          
          controller.error(error);
        }
      },
    });

    // 返回流式响应
    const chatTitle = isGuestMode 
      ? (chat as TempChat).title 
      : (chat as unknown as Document & { title: string }).title;
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Session-Id": sessionId,
        "X-Chat-Title": encodeURIComponent(chatTitle),
        "X-Is-Guest": isGuestMode ? "true" : "false",
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
