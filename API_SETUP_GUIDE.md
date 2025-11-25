# API 服务配置指南

## 1. 智谱AI (GLM) 配置

### 注册和获取API密钥
1. 访问：https://open.bigmodel.cn/
2. 注册账户并完成实名认证
3. 进入 "API密钥管理" 页面
4. 点击 "创建新的API密钥"
5. 复制生成的API密钥

### 配置信息
```bash
AI_API_KEY=your-zhipu-ai-api-key
AI_MODEL=glm-4-flashx  # 或 glm-4, glm-3-turbo
```

### 注意事项
- 新用户通常有免费额度
- 推荐使用 glm-4-flashx (性价比高)
- API密钥请妥善保存，不要提交到代码仓库

---

## 2. 百度AI配置

### 获取Access Key和Secret Key
1. 访问：https://cloud.baidu.com/
2. 注册并登录百度智能云
3. 进入 "产品与服务" > "人工智能" > "文本处理"
4. 创建应用并获取API密钥
5. 记录 Access Key (AK) 和 Secret Key (SK)

### 配置信息
```bash
BAIDU_AK=your-baidu-access-key
BAIDU_SK=your-baidu-secret-key
```

### 所需服务
- 文本摘要服务
- 确保在控制台中启用相关服务

---

## 3. Pinecone 向量数据库配置

### 注册和设置
1. 访问：https://www.pinecone.io/
2. 注册账户（可使用GitHub登录）
3. 创建新项目
4. 创建索引 (Index)：
   - Name: `finalindex` (与代码中一致)
   - Dimensions: 1536 (OpenAI embeddings标准)
   - Metric: cosine

### 获取配置信息
1. 在 Pinecone 控制台获取：
   - API Key
   - Environment/Host 地址

### 配置信息
```bash
PINECONE_API_KEY=your-pinecone-api-key
HOST_ADD=your-pinecone-host-address
```

---

## 4. MongoDB Atlas 配置

### 创建数据库
1. 访问：https://www.mongodb.com/cloud/atlas
2. 注册并登录
3. 创建免费集群 (Shared Cluster)
4. 等待集群创建完成

### 配置网络访问
1. 在 "Network Access" 中添加IP地址
2. 为了简化测试，可以添加 `0.0.0.0/0` (允许所有IP)
3. ⚠️ 生产环境请限制具体IP

### 创建数据库用户
1. 在 "Database Access" 中创建用户
2. 设置用户名和密码
3. 分配 "readWrite" 权限

### 获取连接字符串
1. 点击 "Connect" 按钮
2. 选择 "Connect your application"
3. 复制连接字符串
4. 替换 `<password>` 和 `<dbname>`

### 配置信息
```bash
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/lawai?retryWrites=true&w=majority
```

---

## 5. NextAuth.js 配置

### 生成密钥
在终端运行以下命令生成随机密钥：
```bash
openssl rand -base64 32
```

### 配置信息
```bash
NEXTAUTH_SECRET=生成的随机密钥
NEXTAUTH_URL=https://your-vercel-app.vercel.app
```

---

## 6. Google OAuth 配置 (可选)

### 创建Google应用
1. 访问：https://console.developers.google.com/
2. 创建新项目或选择现有项目
3. 启用 "Google+ API"
4. 创建 OAuth 2.0 凭据

### 配置回调URL
在 "授权重定向URI" 中添加：
```
https://your-vercel-app.vercel.app/api/auth/callback/google
http://localhost:3000/api/auth/callback/google  # 开发环境
```

### 配置信息
```bash
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret
```

---

## ✅ 配置完成检查清单

- [ ] 智谱AI API密钥已获取
- [ ] 百度AI AK/SK已获取  
- [ ] Pinecone 数据库已创建，API密钥已获取
- [ ] MongoDB Atlas 数据库已创建，连接字符串已获取
- [ ] NextAuth 密钥已生成
- [ ] Google OAuth 已配置 (可选)

完成以上配置后，将所有密钥填入 `.env.local` 文件中。