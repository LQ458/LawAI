/**
 * Chat userId 迁移脚本
 * 
 * 用途: 将现有 Chat 记录的 userId 从 ObjectId 格式转换为 email 格式
 * 
 * 使用方法:
 * 1. 确保 .env.local 中配置了 MONGODB_URL
 * 2. 运行: node scripts/migrate-chat-userid.js
 * 
 * 注意: 
 * - 迁移前会自动备份现有数据
 * - 只迁移 userId 为有效 ObjectId 的记录
 * - 迁移后会验证数据完整性
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

// 定义 Schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  name: String,
  password: String,
  originalPassword: String,
  admin: Boolean,
  image: String,
  provider: String,
  accounts: Array,
});

const chatSchema = new mongoose.Schema({
  title: String,
  userId: String,
  time: String,
  messages: Array,
});

const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

/**
 * 备份现有 Chat 数据
 */
async function backupChatData() {
  log('\n📦 开始备份数据...', 'cyan');
  
  const chats = await Chat.find({}).lean();
  const backupDir = path.join(__dirname, '../backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `chat-backup-${timestamp}.json`);
  
  fs.writeFileSync(backupFile, JSON.stringify(chats, null, 2));
  
  log(`✅ 数据已备份到: ${backupFile}`, 'green');
  log(`   备份记录数: ${chats.length}`, 'bright');
  
  return backupFile;
}

/**
 * 检查 userId 是否为有效的 ObjectId
 */
function isValidObjectId(userId) {
  if (!userId) return false;
  if (typeof userId !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(userId);
}

/**
 * 检查 userId 是否为 email 格式
 */
function isEmail(userId) {
  if (!userId) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId);
}

/**
 * 迁移 Chat 的 userId
 */
async function migrateChatUserIds() {
  log('\n🔄 开始迁移 userId...', 'cyan');
  
  const stats = {
    total: 0,
    migrated: 0,
    alreadyEmail: 0,
    userNotFound: 0,
    errors: 0,
  };
  
  const chats = await Chat.find({});
  stats.total = chats.length;
  
  log(`📊 找到 ${stats.total} 条 Chat 记录\n`, 'bright');
  
  for (const chat of chats) {
    try {
      // 检查 userId 是否已经是 email 格式
      if (isEmail(chat.userId)) {
        log(`⏭️  Chat ${chat._id}: userId 已经是 email 格式 (${chat.userId})`, 'yellow');
        stats.alreadyEmail++;
        continue;
      }
      
      // 检查 userId 是否为有效的 ObjectId
      if (!isValidObjectId(chat.userId)) {
        log(`⚠️  Chat ${chat._id}: userId 不是有效的 ObjectId (${chat.userId})`, 'yellow');
        stats.errors++;
        continue;
      }
      
      // 查找对应的用户
      const user = await User.findById(chat.userId);
      
      if (!user) {
        log(`❌ Chat ${chat._id}: 找不到用户 (userId: ${chat.userId})`, 'red');
        stats.userNotFound++;
        continue;
      }
      
      if (!user.email) {
        log(`❌ Chat ${chat._id}: 用户没有 email (userId: ${chat.userId}, username: ${user.username})`, 'red');
        stats.errors++;
        continue;
      }
      
      // 更新 userId 为 email
      const oldUserId = chat.userId;
      chat.userId = user.email;
      await chat.save();
      
      log(`✅ Chat ${chat._id}: ${oldUserId} → ${user.email}`, 'green');
      stats.migrated++;
      
    } catch (error) {
      log(`❌ Chat ${chat._id}: 迁移失败 - ${error.message}`, 'red');
      stats.errors++;
    }
  }
  
  return stats;
}

/**
 * 验证迁移结果
 */
async function verifyMigration() {
  log('\n🔍 验证迁移结果...', 'cyan');
  
  const chats = await Chat.find({});
  const issues = [];
  
  for (const chat of chats) {
    // 检查是否还有 ObjectId 格式的 userId
    if (isValidObjectId(chat.userId)) {
      issues.push({
        chatId: chat._id,
        userId: chat.userId,
        issue: 'userId 仍然是 ObjectId 格式',
      });
    }
    
    // 检查 userId 是否为有效的 email
    if (!isEmail(chat.userId)) {
      issues.push({
        chatId: chat._id,
        userId: chat.userId,
        issue: 'userId 不是有效的 email 格式',
      });
    }
  }
  
  if (issues.length === 0) {
    log('✅ 验证通过！所有 Chat 记录的 userId 都是 email 格式', 'green');
    return true;
  } else {
    log(`⚠️  发现 ${issues.length} 个问题:`, 'yellow');
    issues.forEach(issue => {
      log(`   Chat ${issue.chatId}: ${issue.issue} (${issue.userId})`, 'yellow');
    });
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('\n' + '='.repeat(60), 'bright');
    log('Chat userId 迁移脚本', 'bright');
    log('='.repeat(60) + '\n', 'bright');
    
    // 连接数据库
    log('🔌 连接数据库...', 'cyan');
    await mongoose.connect(process.env.MONGODB_URL, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
    log('✅ 数据库连接成功', 'green');
    
    // 备份数据
    const backupFile = await backupChatData();
    
    // 迁移数据
    const stats = await migrateChatUserIds();
    
    // 输出统计信息
    log('\n' + '='.repeat(60), 'bright');
    log('📊 迁移统计', 'bright');
    log('='.repeat(60), 'bright');
    log(`总记录数:       ${stats.total}`, 'bright');
    log(`成功迁移:       ${stats.migrated}`, 'green');
    log(`已是 email:     ${stats.alreadyEmail}`, 'yellow');
    log(`用户不存在:     ${stats.userNotFound}`, 'red');
    log(`错误:           ${stats.errors}`, 'red');
    log('='.repeat(60) + '\n', 'bright');
    
    // 验证迁移结果
    const verified = await verifyMigration();
    
    if (verified && stats.errors === 0 && stats.userNotFound === 0) {
      log('\n🎉 迁移完成！所有数据已成功更新。', 'green');
    } else {
      log('\n⚠️  迁移完成，但存在一些问题。请检查上述输出。', 'yellow');
      log(`   备份文件: ${backupFile}`, 'cyan');
    }
    
  } catch (error) {
    log('\n❌ 迁移失败:', 'red');
    log(error.stack, 'red');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log('\n🔌 数据库连接已关闭', 'cyan');
  }
}

// 执行迁移
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { migrateChatUserIds, backupChatData, verifyMigration };
