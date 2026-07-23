import { NextResponse, NextRequest } from "next/server";
import OpenAI from "openai";
import Chat from "@/models/chat";
import DBconnect from "@/lib/mongodb";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { readJsonObject, cleanBoundedString } from "@/lib/request";
import { getServerIdentity } from "@/lib/serverAuth";
import { consumeRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 20_000;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_CONTEXT_CHARACTERS = 40_000;
const MAX_AI_RESPONSE_LENGTH = 20_000;
const DEEPSEEK_TIMEOUT_MS = 45_000;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const SYSTEM_PROMPT = [
  "你是面向普通用户的法律信息助手，只提供一般性法律信息。",
  "本普通聊天没有连接检索系统或权威法律资料库，回答并非基于检索核验；不得声称已经查阅、核实或引用了具体法条、判例或官方资料。",
  "你的回答不构成法律意见、律师服务或律师与客户关系，也不能替代持证律师结合完整事实提供的建议。",
  "每次回答都应简短明示上述一般法律信息限制。",
  "法律和程序可能变化。请明确提醒用户核对当地最新官方资料，并在涉及期限、重大财产、人身安全或诉讼时咨询合资格的律师或相关机构。",
  "信息不足时先提出必要的澄清问题；不要虚构联系方式、地点、法条或事实。",
].join("");

type AiMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "APIConnectionTimeoutError" ||
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("timeout"))
  );
}

function chatTitle(message: string): string {
  return message.length > 20 ? `${message.slice(0, 20)}...` : message;
}

function boundedContext(
  storedMessages: Array<{ role: string; content: string }>,
  currentMessage: string,
): AiMessage[] {
  const selected: AiMessage[] = [];
  let characters = currentMessage.length;

  for (let index = storedMessages.length - 1; index >= 0; index -= 1) {
    const item = storedMessages[index];
    if (
      item.role === "system" ||
      !["user", "assistant"].includes(item.role) ||
      typeof item.content !== "string"
    ) {
      continue;
    }
    if (
      selected.length >= MAX_CONTEXT_MESSAGES ||
      characters + item.content.length > MAX_CONTEXT_CHARACTERS
    ) {
      break;
    }
    selected.unshift({
      role: item.role as "user" | "assistant",
      content: item.content,
    });
    characters += item.content.length;
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...selected,
    { role: "user", content: currentMessage },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getServerIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await consumeRateLimit("chat", req, identity.subject))) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const body = await readJsonObject(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const message = cleanBoundedString(body.value.message, {
      max: MAX_MESSAGE_LENGTH,
    });
    if (!message) {
      return NextResponse.json(
        {
          error: `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    let chatId: string | null = null;
    if (body.value.chatId !== undefined && body.value.chatId !== "") {
      chatId = cleanBoundedString(body.value.chatId, {
        min: 24,
        max: 24,
      });
      if (!chatId || !OBJECT_ID_PATTERN.test(chatId)) {
        return NextResponse.json(
          { error: "A valid chat ID is required" },
          { status: 400 },
        );
      }
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service is unavailable" },
        { status: 503 },
      );
    }

    await DBconnect();

    const isNewChat = !chatId;
    const chat = chatId
      ? await Chat.findOne({ _id: chatId, userId: identity.subject })
      : new Chat({
          title: chatTitle(message),
          userId: identity.subject,
          time: getCurrentTimeInLocalTimeZone(),
          messages: [{ role: "system", content: SYSTEM_PROMPT }],
        });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const sessionId = chat._id.toString();
    const messages = boundedContext(
      chat.messages as Array<{ role: string; content: string }>,
      message,
    );
    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey,
      timeout: DEEPSEEK_TIMEOUT_MS,
      maxRetries: 0,
    });
    const upstreamAbort = new AbortController();
    let didTimeOut = false;
    let cancelled = false;
    const timeout = setTimeout(() => {
      didTimeOut = true;
      upstreamAbort.abort();
    }, DEEPSEEK_TIMEOUT_MS);

    const createUpstreamStream = () =>
      deepseek.chat.completions.create(
        {
          model: process.env.AI_MODEL || "deepseek-chat",
          messages,
          stream: true,
          max_tokens: 1_500,
        },
        { signal: upstreamAbort.signal },
      );

    let completionStream: Awaited<ReturnType<typeof createUpstreamStream>>;
    try {
      completionStream = await createUpstreamStream();
    } catch (error) {
      clearTimeout(timeout);
      const timedOut = didTimeOut || isTimeoutError(error);
      console.error(
        timedOut
          ? "DeepSeek chat request timed out"
          : "DeepSeek chat request failed",
      );
      return NextResponse.json(
        {
          error: timedOut
            ? "AI service timed out"
            : "AI service is unavailable",
        },
        { status: timedOut ? 504 : 502 },
      );
    }

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        let aiResponse = "";
        try {
          for await (const chunk of completionStream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (!content) {
              continue;
            }
            if (aiResponse.length + content.length > MAX_AI_RESPONSE_LENGTH) {
              upstreamAbort.abort();
              throw new Error("AI response exceeded the storage limit");
            }

            aiResponse += content;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: aiResponse })}\n\n`,
              ),
            );
          }

          if (!aiResponse.trim()) {
            throw new Error("AI service returned no content");
          }

          const now = getCurrentTimeInLocalTimeZone();
          const userMessage = {
            role: "user" as const,
            content: message,
            timestamp: new Date(),
          };
          const assistantMessage = {
            role: "assistant" as const,
            content: aiResponse,
            timestamp: new Date(),
          };

          if (isNewChat) {
            chat.messages.push(userMessage, assistantMessage);
            chat.time = now;
            await chat.save();
          } else {
            const update = await Chat.updateOne(
              { _id: sessionId, userId: identity.subject },
              {
                $push: {
                  messages: { $each: [userMessage, assistantMessage] },
                },
                $set: { time: now },
              },
            );
            if (update.matchedCount !== 1) {
              throw new Error("Chat disappeared before it could be updated");
            }
          }

          controller.close();
        } catch (error) {
          if (cancelled) {
            return;
          }
          const timedOut = didTimeOut || isTimeoutError(error);
          console.error(
            timedOut
              ? "DeepSeek chat stream timed out"
              : "Chat stream processing failed",
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: timedOut
                  ? "AI service timed out"
                  : "AI service is unavailable",
              })}\n\n`,
            ),
          );
          controller.close();
        } finally {
          clearTimeout(timeout);
        }
      },
      cancel() {
        cancelled = true;
        clearTimeout(timeout);
        upstreamAbort.abort();
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
        Connection: "keep-alive",
        "X-Session-Id": sessionId,
      },
    });
  } catch {
    console.error("Authenticated chat request failed");
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
