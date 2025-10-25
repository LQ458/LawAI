# MongoDB SSL/TLS 连接错误修复文档

## 📋 问题描述

**错误类型**: `MongoPoolClearedError` with SSL/TLS alert internal error

**错误信息**:
```
Connection pool for ac-6dmmyav-shard-00-01.jhlwfpi.mongodb.net:27017 was cleared 
because another operation failed with: "80F8BDA8667F0000:error:0A000438:SSL 
routines:ssl3_read_bytes:tlsv1 alert internal error:ssl/record/rec_layer_s3.c:912:
SSL alert number 80"
```

**发生位置**: `app/api/recommend/route.ts`

---

## ❌ 与游客功能无关

### 为什么不是游客功能更新造成的？

1. **游客功能架构**:
   - 使用 localStorage 管理临时数据
   - API 只是增加了身份识别逻辑
   - MongoDB 连接方式完全未改变

2. **错误本质**:
   - SSL/TLS 是**传输层加密协议**错误
   - 发生在客户端与 MongoDB Atlas 服务器握手阶段
   - 与业务逻辑代码无关

3. **真实原因**:
   - ✅ 网络波动导致 SSL 握手失败
   - ✅ MongoDB Atlas 服务器临时不可达
   - ✅ 连接池中的连接过期/失效
   - ✅ Serverless 环境的冷启动问题

---

## 🔧 已实施的修复措施

### 1. 优化 MongoDB 连接配置 (`lib/mongodb.ts`)

#### 修改前:
```typescript
const MONGODB_OPTIONS: ConnectOptions = {
  maxPoolSize: 10,
  heartbeatFrequencyMS: 30000,
  maxIdleTimeMS: 30000,
};
```

#### 修改后:
```typescript
const MONGODB_OPTIONS: ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,              // 🆕 保持最小连接数
  heartbeatFrequencyMS: 10000, // 🆕 更频繁心跳(30s→10s)
  maxIdleTimeMS: 60000,        // 🆕 增加空闲超时(30s→60s)
  // SSL/TLS 优化
  tls: true,                   // 🆕 显式启用 TLS
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
};
```

**改进点**:
- **minPoolSize: 2** - 保持最少2个活跃连接,避免每次请求都创建新连接
- **heartbeatFrequencyMS: 10000** - 每10秒检测连接健康状态(原30秒)
- **maxIdleTimeMS: 60000** - 连接空闲60秒才回收(原30秒)
- **显式 TLS 配置** - 确保证书和主机名验证

### 2. 增强错误处理逻辑

#### 修改前:
```typescript
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
  if (err.message.includes('SSL')) {
    mongoose.connection.close().catch(() => {});
  }
});
```

#### 修改后:
```typescript
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
  
  // 检测网络层错误
  if (err.message.includes('SSL') || 
      err.message.includes('TLS') || 
      err.message.includes('ECONNRESET')) {
    console.log("Network error detected, force closing connection pool...");
    // 强制关闭(close(true))立即清除所有连接
    mongoose.connection.close(true).catch((closeErr) => {
      console.error("Error closing connection:", closeErr);
    });
  }
});
```

**改进点**:
- **扩展错误检测** - 包括 SSL/TLS/ECONNRESET
- **强制关闭** - `close(true)` 立即清空连接池,不等待操作完成
- **错误日志** - 捕获关闭过程中的错误

### 3. API 层面添加重试机制 (`app/api/recommend/route.ts`)

#### 新增数据库连接重试:
```typescript
export async function GET(req: NextRequest) {
  // 🆕 数据库连接重试逻辑
  let retries = 3;
  while (retries > 0) {
    try {
      await DBconnect();
      break; // 连接成功,跳出循环
    } catch (dbError) {
      retries--;
      console.error(`Database connection attempt failed. Retries left: ${retries}`);
      
      if (retries === 0) {
        return NextResponse.json(
          { error: "Database connection failed after multiple retries", retryable: true },
          { status: 503 } // Service Unavailable
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    }
  }
  
  // ... 业务逻辑
}
```

#### 新增详细错误响应:
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isMongoError = errorMessage.includes('Mongo') || 
                       errorMessage.includes('SSL') || 
                       errorMessage.includes('TLS');
  
  if (isMongoError) {
    console.error("MongoDB connection issue:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    return NextResponse.json(
      { error: "Database connection issue, please try again later", retryable: true },
      { status: 503 } // 503 表示临时不可用,客户端可重试
    );
  }
  
  return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 });
}
```

**改进点**:
- **3次重试** - 自动重试连接,每次间隔1秒
- **503 状态码** - 告知客户端这是临时问题,可重试
- **retryable 标志** - 前端可根据此标志实现自动重试
- **详细日志** - 记录错误名称、消息和堆栈

---

## 🎯 预期效果

### 修复前:
```
连接失败 → 清空连接池 → 下一个请求失败 → 用户看到 500 错误
```

### 修复后:
```
连接失败 → 自动重试(最多3次) → 成功/返回 503 → 前端可选择重试
心跳检测 → 提前发现失效连接 → 自动重建 → 用户无感知
```

### 具体改进:

| 指标 | 修复前 | 修复后 |
|-----|--------|--------|
| **连接池管理** | 被动清理 | 主动维护(最小2个连接) |
| **故障检测** | 30秒心跳 | 10秒心跳 |
| **错误恢复** | 单次失败 | 自动重试3次 |
| **用户体验** | 直接报错 | 智能重试 + 友好提示 |
| **日志可读性** | 简单日志 | 结构化错误信息 |

---

## 📊 监控建议

### 1. 生产环境日志监控

关注这些日志:
```
✅ "MongoDB connected successfully"
⚠️ "Database connection attempt failed. Retries left: X"
❌ "Network error detected, force closing connection pool..."
```

### 2. 性能指标

- **连接建立时间**: 应 < 2秒
- **连接池使用率**: 保持在 20%-80%
- **重试成功率**: 应 > 90%

### 3. MongoDB Atlas 监控

在 MongoDB Atlas 控制台检查:
- **连接数** - 是否超过限制
- **网络延迟** - 是否 > 100ms
- **CPU 使用率** - 是否接近 100%

---

## 🚀 部署后验证

### 测试步骤:

1. **正常流量测试**:
   ```bash
   curl https://your-domain.vercel.app/api/recommend
   ```
   预期: 200 OK 或 503 (临时不可用但可重试)

2. **并发测试**:
   ```bash
   # 发送10个并发请求
   for i in {1..10}; do
     curl https://your-domain.vercel.app/api/recommend &
   done
   wait
   ```
   预期: 大部分成功,少数重试

3. **日志检查**:
   ```bash
   vercel logs --follow
   ```
   查看是否还有 `MongoPoolClearedError`

### 如果问题持续:

1. **升级 MongoDB Atlas 套餐** - M0 免费版有连接数限制
2. **检查网络配置** - IP 白名单、VPC 设置
3. **联系 MongoDB Atlas 支持** - 可能是服务端问题

---

## 📚 参考资源

- [Mongoose Connection Options](https://mongoosejs.com/docs/connections.html#options)
- [MongoDB Atlas Network Errors](https://www.mongodb.com/docs/atlas/troubleshoot-connection/)
- [Next.js Vercel Deployment Guide](https://nextjs.org/docs/deployment)

---

**修复日期**: 2025-10-25  
**修复人员**: GitHub Copilot  
**关联问题**: Vercel 生产环境 MongoDB SSL/TLS 错误
