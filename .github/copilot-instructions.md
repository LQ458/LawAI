# LawAI - AI法律助手 Copilot Instructions

## 项目架构概览

LawAI是基于Next.js 15的智能法律助手应用，集成AI问答、案例推荐和向量检索功能。核心组件：
- **前端**: Next.js 15 + App Router, React 19, TailwindCSS + PrimeReact
- **后端**: Next.js API Routes + MongoDB (Mongoose ODM)
- **认证**: NextAuth.js (Google OAuth + 用户名密码)
- **AI服务**: ZhipuAI GLM-4-flashx模型
- **向量检索**: Pinecone向量数据库 + embedding-3模型
- **推荐系统**: 基于用户行为权重的协同过滤算法

## 关键开发模式

### 1. API路由模式
所有API位于`app/api/`目录，使用统一错误处理和数据库连接模式：
```typescript
// 标准API模式
import DBconnect from "@/lib/mongodb";
await DBconnect(); // 每个API路由都需要显式连接数据库
```

### 2. 数据模型约定
使用Mongoose模型，统一命名和导出模式：
- 文件名: `models/modelName.ts` (小写)
- 导出: `export default ModelNameModel`
- Schema命名: `modelNameSchema`
- 类型接口: `types/index.ts`中定义对应接口

### 3. 认证集成模式
使用NextAuth.js双重认证策略，关键文件：`app/api/auth/[...nextauth]/route.ts`
- Google OAuth + 用户名密码认证
- JWT策略，30天过期
- MongoDBAdapter自动用户管理

### 4. React Hooks模式
自定义hooks位于`hooks/`目录，使用useCallback优化性能：
```typescript
// 示例: useChatState.ts
const deleteChat = useCallback(async (chatId: string, username: string) => {
  // API调用逻辑
}, [依赖项]);
```

## 核心业务逻辑

### AI对话流程 (`app/api/fetchAi/route.ts`)
1. 验证用户和消息
2. 创建或获取现有聊天会话
3. 调用ZhipuAI API生成回复
4. 保存消息到MongoDB
5. 返回流式响应

### 向量检索流程 (`app/api/chromadbtest/route.ts`)
1. 用户查询 → embedding-3模型生成向量
2. Pinecone查询相似案例 (相似度≥0.3)
3. 提取案例元数据
4. AI生成解释性回答

### 推荐算法 (`app/api/recommend/route.ts`)
基于加权评分的推荐系统：
```typescript
const WEIGHTS = {
  VIEW: 1, LIKE: 3, BOOKMARK: 5,
  DURATION: 0.1, TAG_MATCH: 2,
  CATEGORY_MATCH: 1.5, TIME_DECAY: 0.8
};
```

## 关键配置和环境

### 必需环境变量
```env
MONGODB_URL=mongodb+srv://...
NEXTAUTH_SECRET=...
GOOGLE_ID=... / GOOGLE_SECRET=...
AI_API_KEY=... / AI_MODEL=glm-4-flashx
PINECONE_API_KEY=... / HOST_ADD=...
```

### 开发工作流
```bash
pnpm dev          # 开发服务器
pnpm test         # Jest测试
pnpm test:watch   # 测试监视模式
pnpm build        # 生产构建
```

### 数据库连接模式
使用连接池和自动重连，关键配置在`lib/mongodb.ts`：
```typescript
const MONGODB_OPTIONS = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  // 其他连接选项...
};
```

## 项目特定约定

### 1. 组件结构
- 页面组件: `app/页面名/page.tsx`
- 可复用组件: `components/组件名.tsx`
- 样式: TailwindCSS类优先，复杂样式使用`styles/`目录

### 2. 类型定义集中化
所有接口定义在`types/index.ts`，包括：
- `Message`, `Chat`: 聊天相关
- `Case`, `IRecord`: 案例相关
- `MessageRole`: 消息角色枚举

### 3. 中文优先的用户体验
- 所有用户界面为中文
- API响应和错误信息中英文双语
- 注释使用中文，代码使用英文

### 4. 测试策略
Jest配置支持Next.js和TypeScript：
- 组件测试: `__tests__/components/`
- API测试: `__tests__/api/`
- 模块映射: `@/` 别名支持

## 部署和外部集成

### Vercel部署配置
`next.config.mjs`中包含：
- `serverExternalPackages: ['mongoose']` (Mongoose兼容)
- Google头像域名配置
- 环境变量传递

### 向量数据库设置
使用Pinecone "finalindex"索引，"caselist"命名空间，元数据包含title和link字段。

### AI模型集成
ZhipuAI集成模式：文本生成使用glm-4-flashx，向量生成使用embedding-3，包含敏感词检查。

当修改数据模型时，确保同时更新MongoDB索引；添加新API路由时，遵循现有错误处理模式；集成新AI功能时，参考现有ZhipuAI调用模式。