import mongoose, { Document, Model, Schema } from "mongoose";

interface Message {
  role: string;
  content: string;
  timestamp: Date; // 添加时间戳字段
}

interface Chat extends Document {
  title: string;
  chatNum: number;
  time: string;
  messages: Message[];
}

const messageSchema = new Schema<Message>({
  role: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }, // 默认时间戳
});

const chatSchema = new Schema<Chat>({
  title: { type: String, required: true },
  chatNum: { type: Number, required: true },
  time: { type: String, required: true },
  messages: { type: [messageSchema], required: true },
});

const Chat: Model<Chat> =
  mongoose.models.Chat || mongoose.model<Chat>("Chat", chatSchema);
export default Chat;
