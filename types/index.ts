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
  guestId?: string; // 临时用户ID (未登录用户)
  time: string;
  messages: Message[];
}

// 临时用户标识接口
export interface GuestIdentity {
  guestId: string;
  createdAt: number;
  expiresAt?: number;
}

// 用户身份接口 (统一已登录和未登录用户)
export interface UserIdentity {
  userId?: string; // 已登录用户的真实ID
  guestId?: string; // 未登录用户的临时ID
  isGuest: boolean; // 是否为临时用户
  identifier: string; // 统一标识符 (userId 或 guestId)
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

export interface Case {
  id: string;
  _id: string;
  title: string;
  summary: string;
  tags: string[];
  likes: number;
  bookmarks: number;
  createdAt: string;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export type SortOption = "latest" | "popular" | "mostLiked";

export interface IRecord {
  _id: string;
  title: string;
  link?: string;
  description: string;
  content: string;
  date: string;
  tags: string[];
  category: string;
  views: number;
  likes: number;
  bookmarks?: number;
  relevantCases?: string[];
  vectorEmbedding?: number[];
  interactionScore?: number;
  recommendScore?: number;
  lastUpdateTime: Date;
  createdAt: Date;
  bookmarked?: boolean;
}

export interface IRecordWithUserState extends IRecord {
  isLiked: boolean;
  isBookmarked: boolean;
  score: number;
}

// 临时用户行为记录接口 (存储在localStorage)
export interface GuestAction {
  recordId: string;
  action: 'view' | 'like' | 'bookmark';
  timestamp: number;
  duration?: number; // 浏览时长(秒)
}

export interface GuestProfile {
  guestId: string;
  actions: GuestAction[];
  likedRecords: string[];
  bookmarkedRecords: string[];
  viewHistory: Array<{
    recordId: string;
    timestamp: number;
    duration?: number;
  }>;
  createdAt: number;
}

export interface RecommendationResponse {
  id?: string;
  _id?: string;
  title: string;
  link?: string;
  author?: string;
  description: string;
  content: string;
  date: string;
  publishDate?: Date;
  tags: string[];
  views: number;
  likes: number;
  recommendScore?: number;
  lastUpdateTime: Date;
  createdAt: Date;
  isLiked?: boolean;
  isBookmarked?: boolean;
}
