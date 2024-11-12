// 定义消息角色类型
export type MessageRole = "function" | "system" | "user" | "assistant";

// 消息接口
export interface Message {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

// 聊天接口
export interface Chat {
  _id: string;
  title: string;
  userId?: string;
  time: string;
  messages: Message[];
}

// 聊天组件属性接口
export interface ChatProps {
  role: MessageRole; // 修改为使用 MessageRole 类型
  message: string;
  isTemporary?: boolean;
}

// 消息选项接口 (如果与 Message 接口完全相同，可以直接使用 Message)
export type MessageOptions = Message;

// 如果需要额外的类型导出，可以在这里添加
