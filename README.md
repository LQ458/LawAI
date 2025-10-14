# LawAI - Intelligent Legal Assistant

LawAI is an AI-powered legal assistant application designed to provide users with intelligent legal case recommendations, case summaries, and legal consultation services. By integrating Baidu AI's text summarization capabilities and a RAG (Retrieval-Augmented Generation) based intelligent Q&A system, it delivers accurate and efficient legal information services.

## Features

### Intelligent Case Recommendations

- Personalized recommendation system based on user interactions
- Support for case likes and bookmarks functionality
- Infinite scroll loading for more cases
- Real-time recommendation content updates
- Smart sorting and filtering capabilities

### Intelligent Case Summarization

- Integrated with Baidu AI text summarization capabilities
- Support for intelligent processing of long texts
- Generate structured case summaries
- Quickly grasp key case points
- Support for multi-dimensional analysis

### Intelligent Legal Q&A

- Context-aware Q&A based on RAG
- Real-time conversational interaction
- History record preservation
- Accurate legal knowledge matching
- Support for multi-turn conversation understanding

## Technology Stack

### Frontend Technologies

- **Core Framework:** Next.js 15, React 19
- **Development Language:** TypeScript
- **UI Framework:**
  - TailwindCSS - Atomic CSS framework
  - PrimeReact - UI component library
- **State Management:** React Hooks
- **Routing System:** Next.js App Router

### Backend Technologies

- **Service Framework:** Next.js API Routes
- **Database:** MongoDB
- **Authentication System:** NextAuth.js
- **API Integration:**
  - Baidu AI Interface
  - Intelligent Q&A System

### AI Capabilities

- **Text Summarization:** Baidu AI ERNIE-Text
- **Intelligent Q&A:**
  - RAG Retrieval-Augmented Generation
  - Vector database support
  - Knowledge base management

### Development Tools

- **Code Standards:** ESLint, Prettier
- **Version Control:** Git
- **Package Manager:** pnpm
- **Development Environment:** Node.js 18+

## Installation & Deployment

### System Requirements

- Node.js 18.0.0 or higher
- MongoDB 4.4 or higher
- pnpm 8.0.0 or higher

### Installation Steps

1. Clone the project

```bash
git clone https://github.com/LQ458/LawAI.git
cd LawAI
```

2. Install dependencies

```bash
pnpm install
```

3. Environment Configuration
   Create a `.env.local` file and configure the following environment variables:

```env
# Database Configuration
MONGODB_URL=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/your-database

# Authentication Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret

# Baidu AI Configuration
BAIDU_AK=your-baidu-api-key
BAIDU_SK=your-baidu-secret-key

# AI Model Configuration
AI_API_KEY=your-ai-api-key
AI_BASE_URL=https://your-ai-service-url
AI_MODEL=your-model-name
```

4. Development Environment Startup

```bash
pnpm dev
```

5. Production Environment Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
LawAI/
├── app/                # Page components
│   ├── api/           # API routes
│   │   ├── auth/      # Authentication related APIs
│   │   ├── cases/     # Case related APIs
│   │   ├── chat/      # Chat related APIs
│   │   └── summary/   # Summary related APIs
│   ├── recommend/     # Recommendation page
│   └── summary/       # Summary page
├── components/        # Reusable components
│   ├── CaseCard/     # Case card component
│   ├── ChatComponent/# Chat component
│   └── AuthForm/     # Authentication form component
├── models/           # Data models
│   ├── record.ts    # Case record model
│   ├── user.ts      # User model
│   └── chat.ts      # Chat record model
├── hooks/            # Custom Hooks
├── lib/             # Utility functions
├── styles/          # Style files
└── types/           # TypeScript type definitions
```

## API Documentation

### Case Recommendation API

```typescript
// Get recommended case list
GET /api/recommend
Query Parameters:
- page: number (optional) - Page number
- limit: number (optional) - Items per page
Response:
{
  recommendations: IRecord[];
  hasMore: boolean;
}

// Case like
POST /api/cases/like
Request Body:
{
  recordId: string;
}
Response:
{
  liked: boolean;
}

// Case bookmark
POST /api/cases/bookmark
Request Body:
{
  recordId: string;
}
Response:
{
  bookmarked: boolean;
}
```

### Case Summary API

```typescript
// Generate case summary
POST /api/summary
Request Body:
{
  content: string;  // Original case text
  options?: {
    maxLength?: number;  // Maximum length
    format?: string;    // Output format
  }
}
Response:
{
  summary: string;
  keywords: string[];
}
```

### Intelligent Q&A API

```typescript
// Send question to get answer
POST /api/chat
Request Body:
{
  message: string;
  chatId?: string;  // Session ID
  context?: string; // Context information
}
Response:
{
  answer: string;
  references?: string[];
  confidence: number;
}
```

## Contributing Guidelines

### Development Workflow

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Standards

- Use ESLint and Prettier for code formatting
- Follow TypeScript best practices
- Use functional components and Hooks for components
- Keep code clean and maintainable

### Commit Convention

- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code formatting changes
- refactor: Code refactoring
- test: Test case changes
- chore: Other changes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Contact Us

- Email: your.email@example.com
- GitHub Issues: https://github.com/yourusername/LawAI/issues
- WeChat Group: Add administrator WeChat to join discussion group

## Acknowledgments

Thanks to the following open source projects for their support:

- [Next.js](https://nextjs.org/) - React application development framework
- [PrimeReact](https://primereact.org/) - UI component library
- [TailwindCSS](https://tailwindcss.com/) - CSS framework
- [MongoDB](https://www.mongodb.com/) - Database
- [NextAuth.js](https://next-auth.js.org/) - Authentication solution

## Changelog

### [1.0.0] - 2024-02-06

- Initial release
- Implemented basic recommendation functionality
- Integrated Baidu AI summarization capabilities
- Added RAG intelligent Q&A system

### [0.9.0] - 2024-01-20

- Beta version release
- Completed core functionality development
- Optimized user experience
- Fixed known issues

---

# 中文版本 (Chinese Version)

# LawAI - 智能法律助手

LawAI 是一个基于人工智能的法律助手应用，旨在为用户提供智能化的法律案例推荐、案例总结和法律咨询服务。通过整合百度AI的文本摘要能力和基于RAG(检索增强生成)的智能问答系统，为用户提供准确、高效的法律信息服务。

## 功能特性

### 智能案例推荐

- 基于用户交互的个性化推荐系统
- 支持案例点赞、收藏功能
- 无限滚动加载更多案例
- 实时更新推荐内容
- 智能排序和过滤功能

### 案例智能总结

- 集成百度AI文本摘要能力
- 支持长文本智能处理
- 生成结构化的案例摘要
- 快速把握案例要点
- 支持多维度解析

### 智能法律问答

- 基于RAG的上下文感知问答
- 实时对话交互
- 历史记录保存
- 准确的法律知识匹配
- 支持多轮对话理解

## 技术栈

### 前端技术

- **核心框架:** Next.js 15, React 19
- **开发语言:** TypeScript
- **UI框架:**
  - TailwindCSS - 原子化CSS框架
  - PrimeReact - UI组件库
- **状态管理:** React Hooks
- **路由系统:** Next.js App Router

### 后端技术

- **服务框架:** Next.js API Routes
- **数据库:** MongoDB
- **认证系统:** NextAuth.js
- **API集成:**
  - 百度AI接口
  - 智能问答系统

### AI能力

- **文本摘要:** 百度AI ERNIE-Text
- **智能问答:**
  - RAG检索增强生成
  - 向量数据库支持
  - 知识库管理

### 开发工具

- **代码规范:** ESLint, Prettier
- **版本控制:** Git
- **包管理:** pnpm
- **开发环境:** Node.js 18+

## 安装部署

### 环境要求

- Node.js 18.0.0 或更高版本
- MongoDB 4.4 或更高版本
- pnpm 8.0.0 或更高版本

### 安装步骤

1. 克隆项目

```bash
git clone https://github.com/LQ458/LawAI.git
cd LawAI
```

2. 安装依赖

```bash
pnpm install
```

3. 环境配置
   创建 `.env.local` 文件并配置以下环境变量:

```env
# 数据库配置
MONGODB_URL=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/your-database

# 认证配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret

# 百度AI配置
BAIDU_AK=your-baidu-api-key
BAIDU_SK=your-baidu-secret-key

# AI模型配置
AI_API_KEY=your-ai-api-key
AI_BASE_URL=https://your-ai-service-url
AI_MODEL=your-model-name
```

4. 开发环境启动

```bash
pnpm dev
```

5. 生产环境构建

```bash
pnpm build
pnpm start
```

## 项目结构

```
LawAI/
├── app/                # 页面组件
│   ├── api/           # API路由
│   │   ├── auth/      # 认证相关API
│   │   ├── cases/     # 案例相关API
│   │   ├── chat/      # 聊天相关API
│   │   └── summary/   # 总结相关API
│   ├── recommend/     # 推荐页面
│   └── summary/       # 总结页面
├── components/        # 可复用组件
│   ├── CaseCard/     # 案例卡片组件
│   ├── ChatComponent/# 聊天组件
│   └── AuthForm/     # 认证表单组件
├── models/           # 数据模型
│   ├── record.ts    # 案例记录模型
│   ├── user.ts      # 用户模型
│   └── chat.ts      # 聊天记录模型
├── hooks/            # 自定义Hooks
├── lib/             # 工具函数
├── styles/          # 样式文件
└── types/           # TypeScript类型定义
```

## API文档

### 案例推荐API

```typescript
// 获取推荐案例列表
GET /api/recommend
Query参数:
- page: number (可选) - 页码
- limit: number (可选) - 每页数量
响应:
{
  recommendations: IRecord[];
  hasMore: boolean;
}

// 案例点赞
POST /api/cases/like
请求体:
{
  recordId: string;
}
响应:
{
  liked: boolean;
}

// 案例收藏
POST /api/cases/bookmark
请求体:
{
  recordId: string;
}
响应:
{
  bookmarked: boolean;
}
```

### 案例总结API

```typescript
// 生成案例总结
POST /api/summary
请求体:
{
  content: string;  // 案例原文
  options?: {
    maxLength?: number;  // 最大长度
    format?: string;    // 输出格式
  }
}
响应:
{
  summary: string;
  keywords: string[];
}
```

### 智能问答API

```typescript
// 发送问题获取回答
POST /api/chat
请求体:
{
  message: string;
  chatId?: string;  // 会话ID
  context?: string; // 上下文信息
}
响应:
{
  answer: string;
  references?: string[];
  confidence: number;
}
```

## 贡献指南

### 开发流程

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

### 代码规范

- 使用ESLint和Prettier进行代码格式化
- 遵循TypeScript最佳实践
- 组件使用函数式组件和Hooks
- 保持代码简洁和可维护性

### 提交规范

- feat: 新功能
- fix: 修复问题
- docs: 文档修改
- style: 代码格式修改
- refactor: 代码重构
- test: 测试用例修改
- chore: 其他修改

## 开源协议

本项目采用 MIT 协议 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系我们

- Email: your.email@example.com
- GitHub Issues: https://github.com/yourusername/LawAI/issues
- 微信群: 添加管理员微信加入交流群

## 致谢

感谢以下开源项目的支持：

- [Next.js](https://nextjs.org/) - React应用开发框架
- [PrimeReact](https://primereact.org/) - UI组件库
- [TailwindCSS](https://tailwindcss.com/) - CSS框架
- [MongoDB](https://www.mongodb.com/) - 数据库
- [NextAuth.js](https://next-auth.js.org/) - 认证方案

## 更新日志

### [1.0.0] - 2024-02-06

- 初始版本发布
- 实现基础推荐功能
- 集成百度AI摘要能力
- 添加RAG智能问答系统

### [0.9.0] - 2024-01-20

- Beta版本发布
- 完成核心功能开发
- 优化用户体验
- 修复已知问题