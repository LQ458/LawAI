import mongoose, { Model, Schema } from "mongoose";
import { Message, Chat } from "@/types";

const messageSchema = new Schema<Message>({
  role: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }, // 默认时间戳
});

const chatSchema = new Schema<Chat>({
  title: { type: String, required: true },
  userId: { type: String, required: true },
  time: { type: String, required: true },
  messages: { type: [messageSchema], required: true },
});

const ChatModel: Model<Chat> =
  mongoose.models.Chat || mongoose.model<Chat>("Chat", chatSchema);
export default ChatModel;
