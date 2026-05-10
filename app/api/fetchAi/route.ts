import { NextResponse, NextRequest } from "next/server";
import Chat from "@/models/chat";
import DBconnect from "@/lib/mongodb";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { userId, chatId, message } = await req.json();
    let sessionId = chatId;
    let chat;
    let newChatCreated = false;

    await DBconnect();

    if (!userId || !message) {
      return NextResponse.json(
        { error: "User ID and message are required" },
        { status: 400 },
      );
    }

    if (!chatId) {
      try {
        const existingChat = await Chat.findOne({
          userId: userId,
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
            userId: userId,
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
      chat.messages.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });
      await chat.save();
    }

    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY!,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messages = chat.messages.map(
            (m: { role: string; content: string }) => ({
              role: m.role as "system" | "user" | "assistant",
              content: m.content,
            }),
          );

          const stream = await deepseek.chat.completions.create({
            model: process.env.AI_MODEL || "deepseek-chat",
            messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            stream: true,
          });

          let aiResponse = "";

          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              aiResponse += content;
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ content: aiResponse })}\n\n`,
                ),
              );
            }
          }

          if (aiResponse) {
            chat.messages.push({
              role: "assistant",
              content: aiResponse,
              timestamp: new Date(),
            });
            chat.time = getCurrentTimeInLocalTimeZone();
            await chat.save();
          }

          controller.close();

          // AI title generation for new chats
          if (newChatCreated && aiResponse) {
            try {
              const titleResp = await deepseek.chat.completions.create({
                model: process.env.AI_MODEL || "deepseek-chat",
                messages: [
                  { role: "user", content: `用不超过10个字总结这段话的主题："${message}"` },
                ],
                temperature: 0,
              });
              const generatedTitle = titleResp.choices?.[0]?.message?.content?.trim() || "";
              if (generatedTitle.length >= 2 && generatedTitle.length < 20) {
                chat.title = generatedTitle;
                chat.markModified("title");
                await chat.save();
              }
            } catch {
              // keep default
            }
          }
        } catch (error) {
          console.error("Stream processing error:", error);
          if (newChatCreated) {
            try {
              await Chat.findByIdAndDelete(chat._id);
            } catch (deleteError) {
              console.error("Error deleting chat:", deleteError);
            }
          } else if (chat && chat.messages.length > 1) {
            chat.messages.pop();
            chat.time = getCurrentTimeInLocalTimeZone();
            await chat.save();
          }
          controller.error(error);
        }
      },
    });

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
