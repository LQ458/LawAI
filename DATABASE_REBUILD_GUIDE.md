# Chat userId 数据库迁移指南

## 📋 概述

本指南用于将现有 Chat 记录的 `userId` 字段从 **ObjectId 格式**迁移到 **email 格式**。

### 为什么需要迁移？

在项目早期，Chat 模型使用 `user._id` (ObjectId) 作为 userId，但后续功能（Like、Bookmark、UserProfile、游客用户迁移）统一使用 `user.email` (String) 作为 userId。这导致：

- ❌ 游客用户迁移的聊天记录无法显示
- ❌ 推荐系统无法关联聊天行为数据  
- ❌ 数据库中存在两种不同格式的 userId

### 迁移内容

- 将所有 Chat 记录的 `userId` 从 ObjectId 转换为对应用户的 email
- 保留所有聊天历史和消息内容
- 自动备份数据，确保可回滚

---

## 🚀 迁移步骤

### 1. 准备工作

#### 检查环境变量

确保 `.env.local` 中配置了正确的数据库连接：

```bash
MONGODB_URL=mongodb+srv://your-connection-string
```

#### 安装依赖

```bash
# 如果还没有安装 dotenv
pnpm install dotenv
```

### 2. 备份数据库（推荐）

在生产环境执行迁移前，强烈建议先备份整个数据库：

```bash
# 使用 MongoDB Atlas 自动备份
# 或使用 mongodump 命令
mongodump --uri="your-mongodb-uri" --out=./backup-$(date +%Y%m%d)
```

### 3. 执行迁移脚本

#### 开发环境

```bash
cd /workspaces/LawAI
node scripts/migrate-chat-userid.js
```

#### 生产环境

```bash
# 1. 先在测试环境验证
NODE_ENV=staging node scripts/migrate-chat-userid.js

# 2. 确认无误后在生产环境执行
NODE_ENV=production node scripts/migrate-chat-userid.js
```

### 4. 查看迁移输出

脚本会输出详细的迁移过程：

```
============================================================
Chat userId 迁移脚本
============================================================

🔌 连接数据库...
✅ 数据库连接成功

📦 开始备份数据...
✅ 数据已备份到: /workspaces/LawAI/backups/chat-backup-2025-10-25T10-30-00.json
   备份记录数: 150

🔄 开始迁移 userId...
📊 找到 150 条 Chat 记录

✅ Chat 671b9c8d5f3e4a0001234567: 507f1f77bcf86cd799439011 → user@example.com
✅ Chat 671b9c8d5f3e4a0001234568: 507f1f77bcf86cd799439012 → admin@example.com
⏭️  Chat 671b9c8d5f3e4a0001234569: userId 已经是 email 格式 (guest@example.com)

============================================================
📊 迁移统计
============================================================
总记录数:       150
成功迁移:       145
已是 email:     5
用户不存在:     0
错误:           0
============================================================

🔍 验证迁移结果...
✅ 验证通过！所有 Chat 记录的 userId 都是 email 格式

🎉 迁移完成！所有数据已成功更新。

🔌 数据库连接已关闭
```

---

## 📊 迁移脚本功能

### 自动备份

- 在迁移前自动备份所有 Chat 数据到 `backups/` 目录
- 备份文件名包含时间戳，便于识别
- JSON 格式，易于查看和恢复

### 智能迁移

- ✅ 只迁移 userId 为有效 ObjectId 的记录
- ✅ 跳过已经是 email 格式的记录
- ✅ 查找对应用户的 email
- ✅ 逐条更新，记录详细日志
- ✅ 处理错误，不会中断整个流程

### 数据验证

- ✅ 检查所有 Chat 记录的 userId 格式
- ✅ 确认没有遗留的 ObjectId 格式
- ✅ 输出问题记录供人工检查

---

## 🔍 验证迁移结果

### 1. 检查数据库

连接 MongoDB 查看 Chat 集合：

```javascript
// MongoDB Shell
use your-database

// 检查是否还有 ObjectId 格式的 userId
db.chats.find({ userId: { $type: "objectId" } }).count()
// 应该返回 0

// 检查 email 格式的记录
db.chats.find({ userId: { $regex: "@" } }).count()
// 应该等于总记录数
```

### 2. 测试功能

#### 测试已登录用户

1. 登录账号
2. 创建新聊天
3. 刷新页面，检查聊天列表是否显示
4. 删除聊天，检查功能是否正常

#### 测试游客用户迁移

1. 使用游客身份创建多个聊天
2. 登录账号
3. 检查聊天列表是否包含迁移的聊天
4. 打开迁移的聊天，检查消息历史是否完整

---

## 🔧 故障排查

### 问题 1: "用户不存在"

**现象**:
```
❌ Chat 671b9c8d5f3e4a0001234567: 找不到用户 (userId: 507f1f77bcf86cd799439011)
```

**原因**: Chat 记录关联的用户已被删除

**解决方案**:
```bash
# 选项 1: 删除这些孤立的 Chat 记录
db.chats.deleteMany({ userId: ObjectId("507f1f77bcf86cd799439011") })

# 选项 2: 重新创建用户（如果可能）
```

### 问题 2: "用户没有 email"

**现象**:
```
❌ Chat 671b9c8d5f3e4a0001234567: 用户没有 email (userId: 507f..., username: test)
```

**原因**: 用户记录缺少 email 字段（可能是测试数据）

**解决方案**:
```javascript
// 为用户添加 email
db.users.updateOne(
  { _id: ObjectId("507f1f77bcf86cd799439011") },
  { $set: { email: "test@example.com" } }
)

// 然后重新运行迁移脚本
```

### 问题 3: 迁移后聊天列表为空

**检查步骤**:

1. 确认用户登录使用的 email
2. 检查 Chat 记录的 userId 字段
3. 查看 API 日志

```javascript
// 检查用户的聊天记录
db.chats.find({ userId: "user@example.com" })

// 检查用户信息
db.users.findOne({ email: "user@example.com" })
```

### 问题 4: 迁移脚本连接失败

**现象**:
```
❌ 迁移失败:
Error: connect ECONNREFUSED
```

**解决方案**:
```bash
# 1. 检查 .env.local 文件
cat .env.local | grep MONGODB_URL

# 2. 测试数据库连接
mongosh "your-mongodb-uri"

# 3. 检查 IP 白名单（MongoDB Atlas）
```

---

## 📝 回滚方案

如果迁移后出现问题，可以使用备份文件回滚：

### 方法 1: 使用备份文件恢复

```javascript
// restore-from-backup.js
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function restore(backupFile) {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const Chat = mongoose.model('Chat', new mongoose.Schema({
    title: String,
    userId: String,
    time: String,
    messages: Array,
  }));
  
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  
  // 清空现有数据
  await Chat.deleteMany({});
  
  // 恢复备份
  await Chat.insertMany(backup);
  
  console.log(`✅ 已恢复 ${backup.length} 条记录`);
  await mongoose.connection.close();
}

// 使用
restore('./backups/chat-backup-2025-10-25T10-30-00.json');
```

### 方法 2: 使用 MongoDB 完整备份恢复

```bash
# 如果之前使用 mongodump 备份
mongorestore --uri="your-mongodb-uri" --drop ./backup-20251025
```

---

## 🎯 迁移后的代码变更

迁移完成后，以下 API 已更新为使用 email 作为 userId：

### ✅ 已更新的 API

1. **app/api/fetchAi/route.ts**
   - 创建聊天时使用 `user.email`
   - 查询现有聊天使用 `user.email`

2. **app/api/getChats/route.ts**
   - 查询用户聊天列表使用 `user.email`

3. **app/api/deleteChat/route.ts**
   - 删除聊天时使用 `user.email`

### 🔄 统一的 userId 策略

现在所有模型和 API 都使用 email 作为 userId：

- ✅ Chat 模型
- ✅ Like 模型
- ✅ Bookmark 模型
- ✅ UserProfile 模型
- ✅ migrate-guest-data API

---

## 📈 预期收益

迁移完成后：

1. **游客用户体验改善**
   - ✅ 游客创建的聊天能正常迁移
   - ✅ 登录后可以看到迁移的聊天历史

2. **数据一致性**
   - ✅ 所有用户标识统一为 email
   - ✅ 不再有 ObjectId 和 String 混用

3. **推荐系统完善**
   - ✅ 可以基于聊天行为进行推荐
   - ✅ 用户画像更完整

4. **代码可维护性**
   - ✅ 统一的用户标识逻辑
   - ✅ 更清晰的数据关系

---

## 📞 支持

如果迁移过程中遇到问题：

1. 查看备份文件位置: `backups/chat-backup-*.json`
2. 检查迁移日志输出
3. 参考上述故障排查章节
4. 保留备份文件，直到确认迁移成功

---

## ✅ 迁移检查清单

- [ ] 备份数据库
- [ ] 确认环境变量配置正确
- [ ] 在测试环境执行迁移
- [ ] 验证迁移结果（数据库检查）
- [ ] 测试已登录用户功能
- [ ] 测试游客用户迁移流程
- [ ] 检查聊天列表显示正常
- [ ] 检查聊天删除功能正常
- [ ] 在生产环境执行迁移
- [ ] 监控应用日志和用户反馈
- [ ] 保留备份文件至少 7 天

---

**迁移时间**: 预计 2-5 分钟（取决于数据量）  
**影响范围**: Chat 相关功能，需要短暂停机  
**回滚时间**: 1-2 分钟（使用备份文件）
