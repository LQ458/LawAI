/**
 * 临时用户状态管理Hook
 * 为未登录用户提供完整的状态管理
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  getOrCreateGuestId,
  getGuestProfile,
  saveGuestProfile,
  recordGuestAction,
  removeGuestAction,
  getGuestChats,
  saveGuestChat,
  deleteGuestChat,
  updateGuestChatTitle,
  getAllGuestData,
  clearGuestData,
} from '@/lib/guestSession';
import { GuestProfile, GuestIdentity } from '@/types';

interface UseGuestReturn {
  isGuest: boolean;
  guestId: string | null;
  guestProfile: GuestProfile | null;
  guestChats: Array<Record<string, unknown>>;
  
  // 行为记录
  recordAction: (recordId: string, action: 'view' | 'like' | 'bookmark', duration?: number) => void;
  removeAction: (recordId: string, actionType: 'like' | 'bookmark') => void;
  
  // 聊天管理
  saveChat: (chat: Record<string, unknown>) => void;
  deleteChat: (chatId: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  
  // 数据迁移
  migrateToUser: () => Promise<void>;
  
  // 刷新状态
  refreshProfile: () => void;
}

export function useGuest(): UseGuestReturn {
  const { data: session, status } = useSession();
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null);
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [guestChats, setGuestChats] = useState<Array<Record<string, unknown>>>([]);

  const isGuest = status === 'unauthenticated';

  // 初始化临时用户
  useEffect(() => {
    if (isGuest) {
      const identity = getOrCreateGuestId();
      setGuestIdentity(identity);
      
      const profile = getGuestProfile(identity.guestId);
      setGuestProfile(profile);
      
      const chats = getGuestChats(identity.guestId);
      setGuestChats(chats);
    } else {
      setGuestIdentity(null);
      setGuestProfile(null);
      setGuestChats([]);
    }
  }, [isGuest]);

  // 当用户登录时,自动迁移数据
  useEffect(() => {
    if (status === 'authenticated' && guestIdentity) {
      migrateToUser();
    }
  }, [status, guestIdentity]);

  // 记录行为
  const recordAction = useCallback((
    recordId: string,
    action: 'view' | 'like' | 'bookmark',
    duration?: number
  ) => {
    if (!guestIdentity) return;

    recordGuestAction(guestIdentity.guestId, {
      recordId,
      action,
      timestamp: Date.now(),
      duration,
    });

    // 刷新profile
    const updatedProfile = getGuestProfile(guestIdentity.guestId);
    setGuestProfile(updatedProfile);
  }, [guestIdentity]);

  // 移除行为
  const removeAction = useCallback((
    recordId: string,
    actionType: 'like' | 'bookmark'
  ) => {
    if (!guestIdentity) return;

    removeGuestAction(guestIdentity.guestId, recordId, actionType);

    // 刷新profile
    const updatedProfile = getGuestProfile(guestIdentity.guestId);
    setGuestProfile(updatedProfile);
  }, [guestIdentity]);

  // 保存聊天
  const saveChat = useCallback((chat: Record<string, unknown>) => {
    if (!guestIdentity) return;

    saveGuestChat(guestIdentity.guestId, chat);

    // 刷新chats
    const updatedChats = getGuestChats(guestIdentity.guestId);
    setGuestChats(updatedChats);
  }, [guestIdentity]);

  // 删除聊天
  const deleteChatCallback = useCallback((chatId: string) => {
    if (!guestIdentity) return;

    deleteGuestChat(guestIdentity.guestId, chatId);

    // 刷新chats
    const updatedChats = getGuestChats(guestIdentity.guestId);
    setGuestChats(updatedChats);
  }, [guestIdentity]);

  // 更新聊天标题
  const updateChatTitleCallback = useCallback((chatId: string, title: string) => {
    if (!guestIdentity) return;

    updateGuestChatTitle(guestIdentity.guestId, chatId, title);

    // 刷新chats
    const updatedChats = getGuestChats(guestIdentity.guestId);
    setGuestChats(updatedChats);
  }, [guestIdentity]);

  // 数据迁移
  const migrateToUser = useCallback(async () => {
    if (!guestIdentity || !session?.user) return;

    try {
      console.log('🔄 Starting data migration...');
      const guestData = getAllGuestData(guestIdentity.guestId);

      const response = await fetch('/api/migrate-guest-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guestId: guestIdentity.guestId,
          guestData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Migration successful:', result);
        
        // 清除临时数据
        clearGuestData();
        setGuestIdentity(null);
        setGuestProfile(null);
        setGuestChats([]);
      } else {
        console.error('❌ Migration failed:', await response.text());
      }
    } catch (error) {
      console.error('❌ Migration error:', error);
    }
  }, [guestIdentity, session]);

  // 刷新profile
  const refreshProfile = useCallback(() => {
    if (!guestIdentity) return;

    const profile = getGuestProfile(guestIdentity.guestId);
    setGuestProfile(profile);

    const chats = getGuestChats(guestIdentity.guestId);
    setGuestChats(chats);
  }, [guestIdentity]);

  return {
    isGuest,
    guestId: guestIdentity?.guestId || null,
    guestProfile,
    guestChats,
    recordAction,
    removeAction,
    saveChat,
    deleteChat: deleteChatCallback,
    updateChatTitle: updateChatTitleCallback,
    migrateToUser,
    refreshProfile,
  };
}
