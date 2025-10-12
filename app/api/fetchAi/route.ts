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
    const { username, chatId, message, isAnonymous, anonymousUsage } = await req.json();
    let sessionId = chatId;
    let chat;
    let newChatCreated = false; // 添加标记
    let user = null;

    await DBconnect();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // Handle anonymous users
    if (isAnonymous || !username) {
      const currentUsage = anonymousUsage || 0;
      const anonymousLimit = 10;
      
      if (currentUsage >= anonymousLimit) {
        return NextResponse.json(
          { 
            error: "Anonymous trial limit exceeded", 
            message: "您的免费试用次数已用完，请登录或注册继续使用。",
            trialChatsUsed: currentUsage,
            trialChatsLimit: anonymousLimit,
            requiresAuth: true
          },
          { status: 403 }
        );
      }
    } else {
      // Handle authenticated users
      user = await User.findOne({ username });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // 检查用户是否是付费用户或在试用限制内
      if (!user.isPremium && user.trialChatsUsed >= user.trialChatsLimit) {
        return NextResponse.json(
          { 
            error: "Trial limit exceeded", 
            message: "您的免费试用次数已用完，请升级到付费版本继续使用。",
            trialChatsUsed: user.trialChatsUsed,
            trialChatsLimit: user.trialChatsLimit
          },
          { status: 403 }
        );
      }
    }

    // 如果没有 chatId，创建新的聊天
    if (!chatId) {
      try {
        if (isAnonymous || !username) {
          // For anonymous users, create a temporary chat object (not saved to DB)
          chat = {
            _id: `anonymous_${Date.now()}`,
            title: message.substring(0, 20) + (message.length > 20 ? "..." : ""),
            userId: "anonymous",
            time: getCurrentTimeInLocalTimeZone(),
            messages: [
              {
                role: "system",
                content:
                  "您正在为一位农民工提供法律帮助。在回答任何问题之前,请确保首先请求用户提供所有必要的具体信息,以便提供精准、个性化的法律建议。例如,如果用户遇到工伤问题,请询问以下详细信息:工伤发生的时间、地点、受伤部位、医疗费用以及雇主信息等。如果是工资争议,请询问工资支付的具体情况、合同是否存在以及任何相关证据。请避免给出一般性或模糊的建议,确保提供与用户情况完全相关的指导。请在开始提供答案时,结合用户提供的具体信息,给出详细的操作步骤,并尽可能提供实际的联系方式和地点等信息。确保每次提供的答案都是用户可以立刻行动并且符合他们法律需求的。",
              },
              { role: "user", content: message, timestamp: new Date() },
            ],
          };
          sessionId = chat._id;
          newChatCreated = true;
        } else {
          // For authenticated users, save to database as before
          const existingChat = await Chat.findOne({
            userId: user._id,
            title: message.substring(0, 20) + (message.length > 20 ? "..." : ""),
            "messages.length": 2,
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
        }
      } catch (error) {
        console.error("Error creating new chat:", error);
        throw error;
      }
    } else {
      if (isAnonymous || !username) {
        // For anonymous users, create temporary chat object for existing session
        chat = {
          _id: sessionId,
          title: "Anonymous Chat",
          userId: "anonymous",
          time: getCurrentTimeInLocalTimeZone(),
          messages: [
            {
              role: "system",
              content:
                "您正在为一位农民工提供法律帮助。在回答任何问题之前,请确保首先请求用户提供所有必要的具体信息,以便提供精准、个性化的法律建议。例如,如果用户遇到工伤问题,请询问以下详细信息:工伤发生的时间、地点、受伤部位、医疗费用以及雇主信息等。如果是工资争议,请询问工资支付的具体情况、合同是否存在以及任何相关证据。请避免给出一般性或模糊的建议,确保提供与用户情况完全相关的指导。请在开始提供答案时,结合用户提供的具体信息,给出详细的操作步骤,并尽可能提供实际的联系方式和地点等信息。确保每次提供的答案都是用户可以立刻行动并且符合他们法律需求的。",
            },
            { role: "user", content: message, timestamp: new Date() },
          ],
        };
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

          // 保存完整的 AI 响应到数据库（仅对认证用户）
          if (aiResponse) {
            if (isAnonymous || !username) {
              // For anonymous users, just add to temporary chat object
              chat.messages.push({
                role: "assistant",
                content: aiResponse,
                timestamp: new Date(),
              });
              chat.time = getCurrentTimeInLocalTimeZone();
            } else {
              // For authenticated users, save to database
              chat.messages.push({
                role: "assistant",
                content: aiResponse,
                timestamp: new Date(),
              });
              chat.time = getCurrentTimeInLocalTimeZone();
              await chat.save();

              // 增加用户的试用聊天次数（仅对非付费用户）
              if (user && !user.isPremium) {
                await User.findByIdAndUpdate(user._id, {
                  $inc: { trialChatsUsed: 1 }
                });
              }
            }
          }

          // 直接关闭流，不发送完成信号
          controller.close();
        } catch (error) {
          console.error("Stream processing error:", error);
          // 如果是新创建的聊天且发生错误，删除整个聊天（仅对认证用户）
          if (newChatCreated && !isAnonymous && username) {
            try {
              await Chat.findByIdAndDelete(chat._id);
              console.log("Deleted new chat due to error:", chat._id);
            } catch (deleteError) {
              console.error("Error deleting chat:", deleteError);
            }
          } else if (chat && chat.messages.length > 1 && !isAnonymous && username) {
            // 如果是现有聊天，只删除最后一条消息（仅对认证用户）
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
