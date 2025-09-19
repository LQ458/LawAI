# 🚀 Vercel 部署执行指南

## 第一阶段：准备工作

### 1. 本地环境测试
```bash
# 1. 复制环境变量文件
cp .env.local.example .env.local

# 2. 根据 API_SETUP_GUIDE.md 填入所有必需的环境变量

# 3. 安装依赖
pnpm install

# 4. 本地运行测试
pnpm dev
```

访问 `http://localhost:3000` 确保应用正常运行。

### 2. 代码提交
```bash
# 确保所有更改已提交到Git
git add .
git commit -m "feat: add Vercel deployment configuration"
git push origin main
```

---

## 第二阶段：Vercel部署

### 1. 连接Vercel
1. 访问 [vercel.com](https://vercel.com)
2. 使用GitHub账户登录
3. 点击 "New Project"
4. 选择你的 `LawAI` 仓库
5. 点击 "Import"

### 2. 项目配置
在导入页面配置以下设置：
- **Framework Preset**: Next.js (自动检测)
- **Root Directory**: `./`
- **Build Command**: `pnpm build`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`
- **Node.js Version**: 18.x

### 3. 环境变量配置
在 "Environment Variables" 部分添加以下变量：

#### 必需变量 (Production + Preview + Development)
```bash
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/lawai
NEXTAUTH_SECRET=your-generated-secret-key
AI_API_KEY=your-zhipu-ai-api-key
BAIDU_AK=your-baidu-access-key
BAIDU_SK=your-baidu-secret-key
PINECONE_API_KEY=your-pinecone-api-key
HOST_ADD=your-pinecone-host-address
```

#### 可选变量
```bash
AI_MODEL=glm-4-flashx
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret
NODE_ENV=production
```

### 4. 部署执行
1. 点击 "Deploy" 按钮
2. 等待构建完成（通常2-5分钟）
3. 获取部署URL（形如：`https://your-app-name.vercel.app`）

---

## 第三阶段：配置更新

### 1. 更新NextAuth URL
部署成功后，需要更新以下配置：

#### 在Vercel控制台更新
- `NEXTAUTH_URL` = `https://your-app-name.vercel.app`

#### 更新Google OAuth（如果使用）
在Google Cloud Console中添加新的回调URL：
- `https://your-app-name.vercel.app/api/auth/callback/google`

### 2. 重新部署
更新环境变量后，在Vercel控制台点击 "Redeploy" 或推送新代码触发重新部署。

---

## 第四阶段：常见问题解决

### 构建错误
**问题**: TypeScript 编译错误
**解决**: 检查类型定义，确保所有依赖正确安装

**问题**: 依赖安装失败
**解决**: 清理pnpm-lock.yaml并重新安装

### 运行时错误
**问题**: MongoDB连接失败
**解决**: 
- 检查MongoDB Atlas网络访问设置
- 验证连接字符串格式
- 确保用户权限正确

**问题**: API请求超时
**解决**: 
- Vercel函数默认10秒超时，已在vercel.json中配置为30秒
- 检查第三方API服务状态

**问题**: 环境变量未生效
**解决**: 
- 确认变量名拼写正确
- 重新部署应用
- 检查变量作用域设置

### 功能测试
**问题**: 登录功能异常
**解决**: 
- 检查NEXTAUTH_SECRET和NEXTAUTH_URL
- 验证Google OAuth配置

**问题**: AI功能不可用
**解决**: 
- 验证API密钥有效性
- 检查API服务余额
- 查看Vercel函数日志

---

## 🎯 部署成功标志

✅ 部署状态显示 "Ready"
✅ 可以正常访问应用首页
✅ 用户注册/登录功能正常
✅ AI对话功能可用
✅ 案例推荐功能正常
✅ 没有控制台错误

---

## 📊 监控和维护

### Vercel 控制台监控
- **Functions**: 查看API调用日志和性能
- **Analytics**: 查看访问统计
- **Speed Insights**: 监控页面性能

### 成本控制
- Vercel Pro计划: $20/月，包含更多函数调用
- MongoDB Atlas: 免费层512MB，足够测试使用
- 各API服务都有免费额度，注意监控使用量

---

## 🔄 更新部署

### 自动部署
推送到main分支会自动触发部署：
```bash
git add .
git commit -m "update: your changes"
git push origin main
```

### 手动部署
在Vercel控制台点击 "Redeploy" 按钮。

---

**下一步**: 完成部署后，参考 `DEPLOYMENT_VERIFICATION.md` 进行全面测试。