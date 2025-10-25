/**
 * 临时用户会话管理
 * 为未登录用户提供完整的功能体验
 */

import { GuestIdentity, GuestProfile, GuestAction } from "@/types";

const GUEST_ID_KEY = 'lawai_guest_id';
const GUEST_PROFILE_KEY = 'lawai_guest_profile';
const GUEST_CHATS_KEY = 'lawai_guest_chats';
const GUEST_EXPIRY_DAYS = 30; // 临时用户数据保留30天

/**
 * 生成唯一的临时用户ID
 */
export function generateGuestId(): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `guest_${timestamp}_${randomStr}`;
}

/**
 * 获取或创建临时用户ID
 */
export function getOrCreateGuestId(): GuestIdentity {
  if (typeof window === 'undefined') {
    // 服务端返回临时ID
    return {
      guestId: generateGuestId(),
      createdAt: Date.now(),
    };
  }

  const stored = localStorage.getItem(GUEST_ID_KEY);
  
  if (stored) {
    try {
      const identity: GuestIdentity = JSON.parse(stored);
      
      // 检查是否过期
      if (identity.expiresAt && identity.expiresAt < Date.now()) {
        // 过期则创建新ID
        return createNewGuestIdentity();
      }
      
      return identity;
    } catch (error) {
      console.error('Failed to parse guest identity:', error);
      return createNewGuestIdentity();
    }
  }
  
  return createNewGuestIdentity();
}

/**
 * 创建新的临时用户身份
 */
function createNewGuestIdentity(): GuestIdentity {
  const identity: GuestIdentity = {
    guestId: generateGuestId(),
    createdAt: Date.now(),
    expiresAt: Date.now() + (GUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  };
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(GUEST_ID_KEY, JSON.stringify(identity));
  }
  
  return identity;
}

/**
 * 获取临时用户Profile
 */
export function getGuestProfile(guestId: string): GuestProfile {
  if (typeof window === 'undefined') {
    return createEmptyGuestProfile(guestId);
  }

  const stored = localStorage.getItem(GUEST_PROFILE_KEY);
  
  if (stored) {
    try {
      const profile: GuestProfile = JSON.parse(stored);
      if (profile.guestId === guestId) {
        return profile;
      }
    } catch (error) {
      console.error('Failed to parse guest profile:', error);
    }
  }
  
  return createEmptyGuestProfile(guestId);
}

/**
 * 创建空的临时用户Profile
 */
function createEmptyGuestProfile(guestId: string): GuestProfile {
  return {
    guestId,
    actions: [],
    likedRecords: [],
    bookmarkedRecords: [],
    viewHistory: [],
    createdAt: Date.now(),
  };
}

/**
 * 保存临时用户Profile
 */
export function saveGuestProfile(profile: GuestProfile): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
}

/**
 * 记录临时用户行为
 */
export function recordGuestAction(
  guestId: string,
  action: GuestAction
): void {
  const profile = getGuestProfile(guestId);
  
  profile.actions.push(action);
  
  // 更新具体行为记录
  switch (action.action) {
    case 'like':
      if (!profile.likedRecords.includes(action.recordId)) {
        profile.likedRecords.push(action.recordId);
      }
      break;
    case 'bookmark':
      if (!profile.bookmarkedRecords.includes(action.recordId)) {
        profile.bookmarkedRecords.push(action.recordId);
      }
      break;
    case 'view':
      profile.viewHistory.push({
        recordId: action.recordId,
        timestamp: action.timestamp,
        duration: action.duration,
      });
      break;
  }
  
  saveGuestProfile(profile);
}

/**
 * 移除临时用户行为
 */
export function removeGuestAction(
  guestId: string,
  recordId: string,
  actionType: 'like' | 'bookmark'
): void {
  const profile = getGuestProfile(guestId);
  
  if (actionType === 'like') {
    profile.likedRecords = profile.likedRecords.filter(id => id !== recordId);
  } else if (actionType === 'bookmark') {
    profile.bookmarkedRecords = profile.bookmarkedRecords.filter(id => id !== recordId);
  }
  
  saveGuestProfile(profile);
}

/**
 * 获取临时用户的聊天记录
 */
export function getGuestChats(guestId: string): Array<Record<string, unknown>> {
  if (typeof window === 'undefined') return [];
  
  const stored = localStorage.getItem(GUEST_CHATS_KEY);
  
  if (stored) {
    try {
      const chats = JSON.parse(stored) as Array<Record<string, unknown>>;
      return chats.filter((chat) => chat.guestId === guestId);
    } catch (error) {
      console.error('Failed to parse guest chats:', error);
    }
  }
  
  return [];
}

/**
 * 保存临时用户的聊天记录
 */
export function saveGuestChat(guestId: string, chat: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  
  const stored = localStorage.getItem(GUEST_CHATS_KEY);
  let chats: Array<Record<string, unknown>> = [];
  
  if (stored) {
    try {
      chats = JSON.parse(stored) as Array<Record<string, unknown>>;
    } catch (error) {
      console.error('Failed to parse guest chats:', error);
    }
  }
  
  // 添加guestId标识
  chat.guestId = guestId;
  
  // 查找是否已存在
  const index = chats.findIndex((c) => c._id === chat._id);
  
  if (index >= 0) {
    chats[index] = chat;
  } else {
    chats.push(chat);
  }
  
  localStorage.setItem(GUEST_CHATS_KEY, JSON.stringify(chats));
}

/**
 * 删除临时用户的聊天记录
 */
export function deleteGuestChat(guestId: string, chatId: string): void {
  if (typeof window === 'undefined') return;
  
  const stored = localStorage.getItem(GUEST_CHATS_KEY);
  
  if (stored) {
    try {
      let chats = JSON.parse(stored) as Array<Record<string, unknown>>;
      chats = chats.filter((chat) => 
        !(chat._id === chatId && chat.guestId === guestId)
      );
      localStorage.setItem(GUEST_CHATS_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error('Failed to delete guest chat:', error);
    }
  }
}

/**
 * 更新临时用户聊天标题
 */
export function updateGuestChatTitle(
  guestId: string,
  chatId: string,
  title: string
): void {
  if (typeof window === 'undefined') return;
  
  const stored = localStorage.getItem(GUEST_CHATS_KEY);
  
  if (stored) {
    try {
      const chats = JSON.parse(stored) as Array<Record<string, unknown>>;
      const chat = chats.find((c) => 
        c._id === chatId && c.guestId === guestId
      );
      
      if (chat) {
        chat.title = title;
        localStorage.setItem(GUEST_CHATS_KEY, JSON.stringify(chats));
      }
    } catch (error) {
      console.error('Failed to update guest chat title:', error);
    }
  }
}

/**
 * 获取所有临时用户数据 (用于数据迁移)
 */
export function getAllGuestData(guestId: string): {
  identity: GuestIdentity | null;
  profile: GuestProfile;
  chats: Array<Record<string, unknown>>;
} {
  if (typeof window === 'undefined') {
    return {
      identity: null,
      profile: createEmptyGuestProfile(guestId),
      chats: [],
    };
  }

  return {
    identity: JSON.parse(localStorage.getItem(GUEST_ID_KEY) || 'null') as GuestIdentity | null,
    profile: getGuestProfile(guestId),
    chats: getGuestChats(guestId),
  };
}

/**
 * 清除临时用户数据
 */
export function clearGuestData(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(GUEST_ID_KEY);
  localStorage.removeItem(GUEST_PROFILE_KEY);
  localStorage.removeItem(GUEST_CHATS_KEY);
}

/**
 * 检查是否为临时用户
 */
export function isGuestUser(identifier?: string): boolean {
  if (!identifier) return true;
  return identifier.startsWith('guest_');
}
