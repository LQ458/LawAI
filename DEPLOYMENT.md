# LawAI 最终部署指南

## 🚀 生产环境部署到 Vercel

### 前置条件
- Node.js 18+
- pnpm
- Git
- 已配置的第三方服务（MongoDB Atlas、ZhipuAI、Google OAuth、Pinecone）

---

## 📋 部署检查清单

### ✅ 代码准备
- [x] 所有功能测试完成
- [x] 环境变量配置文件创建
- [x] TypeScript 错误修复
- [x] JSON 解析错误修复
- [x] MongoDB 连接优化

### 🔧 服务配置
- [x] MongoDB Atlas 数据库运行中
- [x] Google OAuth 应用配置完成
- [x] ZhipuAI API 密钥有效
- [x] Pinecone 向量数据库配置

---

## 🚀 一键部署步骤

### 1. 推送代码到 GitHub
```bash
# 添加所有更改
git add .

# 提交最终版本
git commit -m "🚀 Production ready - Fixed TypeScript errors, JSON parsing, and MongoDB connection"

# 推送到远程仓库
git push origin main
```

### 2. Vercel 项目配置

访问 [Vercel Dashboard](https://vercel.com/dashboard) 并：

1. **创建新项目**
   - 选择 GitHub 仓库: `YinChingZ/LawAI`
   - Framework: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

2. **配置环境变量**

| 变量名 | 必需 | 说明 | 示例值 |
|--------|------|------|--------|
| MONGODB_URL | ✅ | MongoDB Atlas 连接串 | `mongodb+srv://user:pass@cluster.mongodb.net/lawai` |
| NEXTAUTH_SECRET | ✅ | 随机生成的密钥 | `your-random-secret-key-here` |
| NEXTAUTH_URL | ✅ | 生产环境URL | `https://your-app.vercel.app` |
| AI_API_KEY | ✅ | 智谱AI API密钥 | `your-zhipu-ai-key` |
| AI_MODEL | ✅ | AI模型名称 | `glm-4-flashx` |
| PINECONE_API_KEY | ✅ | Pinecone API密钥 | `your-pinecone-key` |
| HOST_ADD | ✅ | Pinecone 主机地址 | `your-index-host.pinecone.io` |
| GOOGLE_ID | ✅ | Google OAuth ID | `your-google-client-id` |
| GOOGLE_SECRET | ✅ | Google OAuth 密钥 | `your-google-client-secret` |

### 3. Google OAuth 生产配置更新

**⚠️ 重要步骤：** 部署后必须更新 Google OAuth 设置

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 导航到 APIs & Services > Credentials
3. 编辑你的 OAuth 2.0 客户端 ID
4. 在**授权的重定向 URI**中添加生产环境地址：
   ```
   https://your-actual-vercel-url.vercel.app/api/auth/callback/google
   ```

### 4. 部署完成验证

部署后请按顺序测试以下功能：

#### 🔍 基础功能测试
- [ ] 主页正常加载
- [ ] Google 登录按钮可见
- [ ] 页面样式正确显示

#### 🔐 认证功能测试  
- [ ] 点击 Google 登录
- [ ] 成功跳转到 Google 授权页面
- [ ] 授权后正确返回应用
- [ ] 显示用户头像和姓名

#### 🤖 AI 对话测试
- [ ] 发送测试消息："你好，我想咨询法律问题"
- [ ] AI 正确回复
- [ ] 流式响应正常显示
- [ ] 没有 JSON 解析错误

#### 📱 页面导航测试
- [ ] 推荐页面 (`/recommend`) 加载正常
- [ ] 总结页面 (`/summary`) 功能正常
- [ ] 页面间导航顺畅

## 故障排除

### 常见问题
1. **MongoDB 连接失败**: 检查 MONGODB_URL 格式和网络访问权限
2. **API 请求超时**: Vercel 函数有30秒超时限制
3. **环境变量未生效**: 确保在 Vercel 控制台正确配置

### 日志查看
在 Vercel 控制台的 Functions 标签页可以查看运行日志。