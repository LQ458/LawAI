# 未登录用户功能使用指南

## 🚀 快速开始

本指南说明如何在前端集成新的未登录用户功能。

## 📦 新增的Hooks

### 1. `useGuest` - 临时用户管理

```typescript
import { useGuest } from '@/hooks/useGuest';

function MyComponent() {
  const {
    isGuest,           // 是否为临时用户
    guestId,           // 临时用户ID
    guestProfile,      // 临时用户画像
    guestChats,        // 临时用户聊天列表
    recordAction,      // 记录行为
    removeAction,      // 移除行为
    saveChat,          // 保存聊天
    deleteChat,        // 删除聊天
    updateChatTitle,   // 更新聊天标题
    migrateToUser,     // 数据迁移
    refreshProfile,    // 刷新状态
  } = useGuest();

  // 示例: 记录浏览行为
  const handleView = (recordId: string) => {
    if (isGuest) {
      recordAction(recordId, 'view', 30); // 浏览30秒
    }
  };

  // 示例: 点赞
  const handleLike = (recordId: string) => {
    if (isGuest) {
      recordAction(recordId, 'like');
    }
  };
}
```

### 2. `useAuth` - 增强的认证Hook

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const {
    isAuthenticated,   // 是否已登录
    user,             // 用户信息
    guestId,          // 临时用户ID (未登录时)
    userIdentifier,   // 统一标识符
    isLoading,
    error,
  } = useAuth();

  // userIdentifier 会自动返回:
  // - 已登录: user.email 或 user.name
  // - 未登录: guestId
}
```

## 🔧 前端集成步骤

### 步骤1: 更新ChatComponent

```typescript
// components/ChatComponent.tsx
import { useAuth } from '@/hooks/useAuth';
import { useGuest } from '@/hooks/useGuest';

function ChatComponent() {
  const { isAuthenticated, userIdentifier } = useAuth();
  const { isGuest, guestId, saveChat } = useGuest();

  const sendMessage = async (message: string) => {
    const response = await fetch('/api/fetchAi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-id': guestId || '', // 添加临时用户ID
      },
      body: JSON.stringify({
        message,
        username: isAuthenticated ? userIdentifier : undefined,
        guestId: isGuest ? guestId : undefined,
        chatId: currentChatId,
      }),
    });

    // 处理流式响应
    const reader = response.body?.getReader();
    let chatData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      // 解析响应...
      
      // 如果是临时用户,保存聊天数据
      if (parsedData.chatData && parsedData.isGuest) {
        chatData = parsedData.chatData;
      }
    }

    // 保存临时用户聊天
    if (isGuest && chatData) {
      saveChat(chatData);
    }
  };

  return (
    <>
      {!isAuthenticated && (
        <div className="login-prompt">
          <button onClick={() => signIn()}>
            登录保存您的对话记录
          </button>
        </div>
      )}
      {/* 其他组件 */}
    </>
  );
}
```

### 步骤2: 更新useChatState Hook

```typescript
// hooks/useChatState.ts
import { useGuest } from './useGuest';

export function useChatState() {
  const { isGuest, guestChats, saveChat, deleteChat: deleteGuestChat } = useGuest();
  const [chats, setChats] = useState([]);

  // 加载聊天列表
  useEffect(() => {
    if (isGuest) {
      setChats(guestChats); // 从localStorage加载
    } else {
      fetchChatsFromAPI(); // 从API加载
    }
  }, [isGuest, guestChats]);

  // 删除聊天
  const deleteChat = async (chatId: string) => {
    if (isGuest) {
      deleteGuestChat(chatId);
    } else {
      await fetch('/api/deleteChat', {
        method: 'DELETE',
        body: JSON.stringify({ chatId }),
      });
    }
  };

  return { chats, deleteChat, ... };
}
```

### 步骤3: 更新CaseCard组件

```typescript
// components/CaseCard.tsx
import { useAuth } from '@/hooks/useAuth';
import { useGuest } from '@/hooks/useGuest';

function CaseCard({ case: caseData }) {
  const { isAuthenticated } = useAuth();
  const { isGuest, guestId, guestProfile, recordAction, removeAction } = useGuest();

  // 判断是否已点赞 (从guestProfile或API获取)
  const [isLiked, setIsLiked] = useState(
    isGuest 
      ? guestProfile?.likedRecords.includes(caseData._id)
      : caseData.isLiked
  );

  const handleLike = async () => {
    const response = await fetch('/api/cases/like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-id': guestId || '',
      },
      body: JSON.stringify({
        recordId: caseData._id,
        guestId: isGuest ? guestId : undefined,
      }),
    });

    const result = await response.json();

    if (result.isGuest) {
      // 临时用户 - 更新本地状态
      if (isLiked) {
        removeAction(caseData._id, 'like');
      } else {
        recordAction(caseData._id, 'like');
      }
      setIsLiked(!isLiked);
    } else {
      // 已登录用户 - 使用API返回的状态
      setIsLiked(result.liked);
    }
  };

  return (
    <div className="case-card">
      {/* 案例内容 */}
      <button onClick={handleLike}>
        {isLiked ? '已点赞' : '点赞'}
      </button>

      {!isAuthenticated && (
        <div className="login-hint">
          <small>登录后保存您的点赞</small>
        </div>
      )}
    </div>
  );
}
```

### 步骤4: 集成自动数据迁移

```typescript
// app/SessionProviderWrapper.tsx 或类似组件
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useGuest } from '@/hooks/useGuest';

export function SessionProviderWrapper({ children }) {
  const { data: session } = useSession();
  const { guestId, migrateToUser } = useGuest();

  // 当用户登录且有临时数据时,自动迁移
  useEffect(() => {
    if (session?.user && guestId) {
      console.log('🔄 Auto-migrating guest data...');
      migrateToUser();
    }
  }, [session, guestId, migrateToUser]);

  return <>{children}</>;
}
```

### 步骤5: 更新案例列表获取

```typescript
// hooks/useCases.ts
import { useGuest } from './useGuest';

export function useCases() {
  const { isGuest, guestProfile } = useGuest();

  const fetchCases = async (filters) => {
    const response = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...filters,
        guestProfile: isGuest ? guestProfile : undefined,
      }),
    });

    return await response.json();
  };

  return { fetchCases, ... };
}
```

## 🎨 UI组件建议

### 登录提示横幅

```typescript
// components/LoginPromptBanner.tsx
export function LoginPromptBanner() {
  const { isGuest } = useGuest();
  const { signIn } = useAuth();

  if (!isGuest) return null;

  return (
    <div className="login-banner">
      <p>👋 您正在以访客模式浏览</p>
      <button onClick={() => signIn()}>
        登录以保存您的数据
      </button>
    </div>
  );
}
```

### 功能限制提示

```typescript
// components/FeaturePrompt.tsx
export function FeaturePrompt({ feature }) {
  const { isGuest } = useGuest();

  if (!isGuest) return null;

  return (
    <div className="feature-prompt">
      <small>
        ℹ️ 您的{feature}将保存在本地,登录后自动同步到云端
      </small>
    </div>
  );
}
```

## 📊 使用示例

### 完整的聊天流程 (未登录用户)

```typescript
function ChatPage() {
  const { isGuest, guestId, guestChats, saveChat } = useGuest();
  const [messages, setMessages] = useState([]);

  const sendMessage = async (content: string) => {
    // 1. 发送请求
    const res = await fetch('/api/fetchAi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-id': guestId || '',
      },
      body: JSON.stringify({
        message: content,
        guestId,
      }),
    });

    // 2. 处理流式响应
    const reader = res.body.getReader();
    let fullResponse = '';
    let chatData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          fullResponse = data.content;
          chatData = data.chatData;

          // 更新UI
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: fullResponse,
          }]);
        }
      }
    }

    // 3. 保存聊天 (临时用户)
    if (isGuest && chatData) {
      saveChat(chatData);
    }
  };

  return (
    <div>
      <LoginPromptBanner />
      <ChatMessages messages={messages} />
      <ChatInput onSend={sendMessage} />
    </div>
  );
}
```

## ⚠️ 注意事项

1. **guestId传递**: 所有API调用都需要通过header或body传递guestId
2. **状态同步**: 临时用户的行为需要立即更新本地状态
3. **数据迁移**: 登录后会自动触发迁移,前端无需额外处理
4. **LocalStorage限制**: 临时数据存储在LocalStorage,有5-10MB限制
5. **过期处理**: 临时数据30天后自动过期

## 🧪 测试清单

- [ ] 未登录用户可以完整使用AI对话
- [ ] 未登录用户可以浏览案例
- [ ] 未登录用户可以点赞/收藏 (本地保存)
- [ ] 登录后数据自动迁移
- [ ] 迁移后LocalStorage数据被清除
- [ ] 已登录用户功能不受影响
- [ ] 页面刷新后临时数据保持

## 🔗 相关文件

- **Hooks**: `/hooks/useGuest.ts`, `/hooks/useAuth.ts`
- **工具库**: `/lib/guestSession.ts`, `/lib/authUtils.ts`
- **API**: `/app/api/fetchAi`, `/app/api/cases`, `/app/api/migrate-guest-data`
- **类型**: `/types/index.ts`

## 💡 最佳实践

1. 始终检查 `isGuest` 来决定数据保存位置
2. 使用 `userIdentifier` 作为统一的用户标识
3. API调用失败时优雅降级
4. 提供清晰的登录引导
5. 在关键操作前提示用户登录

---

需要更多帮助?查看完整实施文档: `GUEST_USER_IMPLEMENTATION.md`
