import { NextResponse, NextRequest } from "next/server";
import axios from "axios";
import Chat from "@/models/chat"; // 确保路径正确
import DBconnect from "@/lib/mongodb";
import { Document } from "mongoose"; // 添加 Document 导入

// 定义消息和会话接口
interface Message {
  role: string;
  content: string;
  timestamp: Date; // 添加时间戳字段
}

interface Session {
  messages: Message[];
}

interface IChat extends Document {
  title: string;
  chatNum: number;
  time: string;
  messages: Message[];
}

// 使用内存存储来保存会话上下文
const sessions: Record<string, Session> = {};

// 获取会话，如果不存在则创建一个新的会话
function getSession(sessionId: string): Session {
  if (!sessions[sessionId]) {
    sessions[sessionId] = { messages: [] };
  }
  return sessions[sessionId];
}

// 更新会话，添加新的消息
function updateSession(sessionId: string, message: Message): void {
  const session = getSession(sessionId);
  session.messages.push(message);
}

export async function POST(req: NextRequest) {
  await DBconnect();
  const { id, message } = await req.json();

  let sessionId = id;

  // 如果没有提供 id，则创建一个新的聊天记录
  if (!sessionId) {
    const newChat: IChat = new Chat({
      title: "New Chat",
      chatNum: 0,
      time: new Date().toISOString(),
      messages: [],
    });
    await newChat.save();
    sessionId = newChat.id.toString();
  }

  // 获取当前会话上下文
  const session = getSession(sessionId);

  // 添加用户消息到会话上下文
  const userMessage: Message = {
    role: "user",
    content: message.content,
    timestamp: new Date(), // 添加时间戳
  };
  updateSession(sessionId, userMessage);

  // 查找或创建聊天记录
  let chat = await Chat.findById(sessionId);
  if (!chat) {
    chat = new Chat({
      _id: sessionId,
      title: "New Chat",
      chatNum: 0,
      time: new Date().toISOString(),
      messages: [],
    });
  }

  // 添加消息到聊天记录
  chat.messages.push(userMessage); // 修改为 userMessage
  chat.chatNum += 1;
  await chat.save();

  // 发送请求到 AI 服务，包含完整的上下文
  const baseUrl = process.env.AI_BASE_URL;
  const API_KEY = process.env.AI_API_KEY;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "AI_BASE_URL is not defined" },
      { status: 500 },
    );
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "AI_API_KEY is not defined" },
      { status: 500 },
    );
  }

  try {
    const response = await axios.post(
      baseUrl,
      {
        model: "glm-4",
        messages: session.messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        responseType: "stream",
      },
    );

    const stream = response.data;

    // 添加 AI 响应到会话上下文
    const aiMessage: Message = {
      role: "assistant",
      content: stream,
      timestamp: new Date(), // 添加时间戳
    };
    updateSession(sessionId, aiMessage);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error making API request:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
