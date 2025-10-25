# 推荐页面 TLS 错误修复

## 问题诊断

### 错误现象
```
MongoDB connected successfully
MongoDB disconnected
Recommendation error: [MongoNetworkError: SSL routines:ssl3_read_bytes:tlsv1 alert internal error]
```

### 根本原因

1. **无限制的数据库查询**
   - 前端请求: `limit=9999`
   - 后端使用: `Collection.find()` 无 limit 限制
   - 结果: 可能一次性加载成千上万条记录

2. **SSL/TLS 连接超时**
   - 大查询导致连接保持时间过长
   - `socketTimeoutMS: 45000` (45秒) 不足以完成大查询
   - TLS 握手在数据传输中间失败

3. **连接池配置不足**
   - `maxPoolSize: 10` 对并发大查询不够
   - 没有 `minPoolSize` 维持最小连接

## 修复方案

### 1. 后端 API 优化 (`app/api/recommend/route.ts`)

**添加分页和性能优化:**
```typescript
// 分页参数 (防止无限制查询)
const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
const pageSize = Math.min(
  CONFIG.RESULTS.MAX_PAGE_SIZE, // 最大 50 条
  parseInt(searchParams.get("pageSize") || String(CONFIG.RESULTS.DEFAULT_PAGE_SIZE))
);
const skip = (page - 1) * pageSize;

// 并行查询 + 性能优化
const [recommendations, totalCount] = await Promise.all([
  Collection.find()
    .sort({ interactionScore: -1 })
    .select({ /* 只选择需要的字段 */ })
    .skip(skip)
    .limit(pageSize)
    .lean() // 返回普通对象,不是 Mongoose 文档
    .maxTimeMS(10000) // 10秒查询超时保护
    .exec(),
  Collection.countDocuments().maxTimeMS(5000) // 5秒超时
]);
```

**关键改进:**
- ✅ 强制分页限制 (最大 50 条/页)
- ✅ 使用 `.lean()` 提高查询性能 (减少内存使用)
- ✅ 添加 `.maxTimeMS()` 防止长时间查询
- ✅ 并行执行查询和计数,提高响应速度
- ✅ 更详细的错误处理

### 2. MongoDB 连接优化 (`lib/mongodb.ts`)

**增强连接配置:**
```typescript
const MONGODB_OPTIONS: ConnectOptions = {
  bufferCommands: false,
  autoIndex: true,
  maxPoolSize: 15, // ⬆️ 从 10 增加到 15
  minPoolSize: 5,  // ✨ 新增: 维持最小连接数
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000, // ⬆️ 从 45000 增加到 60000
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  heartbeatFrequencyMS: 30000,
  maxIdleTimeMS: 60000, // ⬆️ 从 30000 增加到 60000
  // ✨ 新增: TLS/SSL 优化
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
};
```

**关键改进:**
- ✅ 增加连接池大小 (10 → 15)
- ✅ 维持最小连接数 (5) 避免频繁建立/关闭连接
- ✅ 延长 socket 超时 (45s → 60s)
- ✅ 延长最大空闲时间 (30s → 60s)
- ✅ 显式启用 TLS 并配置证书验证

### 3. 前端请求优化 (`app/recommend/page.tsx`)

**修复无限制查询:**
```typescript
// ❌ 之前: 请求 9999 条记录
const response = await fetch(
  `/api/recommend?page=1&limit=9999&contentType=${type}&t=${Date.now()}`
);

// ✅ 现在: 合理的分页请求
const response = await fetch(
  `/api/recommend?page=1&pageSize=50&contentType=${type}&t=${Date.now()}`
);
```

## 性能对比

### 修复前
- 查询时间: 可能超过 45 秒 (导致超时)
- 内存使用: 可能加载数万条记录到内存
- 连接状态: 长时间占用连接,导致池耗尽
- SSL 连接: 在大数据传输中间断开

### 修复后
- 查询时间: < 10 秒 (有超时保护)
- 内存使用: 最多 50 条记录
- 连接状态: 快速释放,支持更多并发
- SSL 连接: 在合理时间内完成传输

## 部署步骤

```bash
# 1. 提交修改
git add app/api/recommend/route.ts lib/mongodb.ts app/recommend/page.tsx
git commit -m "fix: resolve TLS error in recommend API with pagination and connection optimization"

# 2. 推送到远程
git push

# 3. Vercel 自动部署
# 监控日志确认无 TLS 错误
```

## 验证清单

部署后验证以下功能:

- [ ] 推荐页面正常加载
- [ ] 无 MongoDB TLS 错误
- [ ] 筛选功能正常
- [ ] 分页功能正常
- [ ] 其他页面不受影响

## 未来优化建议

1. **实现真正的分页** - 目前只取前 50 条,可以添加"加载更多"功能
2. **添加缓存层** - 使用 Redis 缓存热门推荐
3. **数据库索引** - 确保 `interactionScore` 字段有索引
4. **CDN 缓存** - 静态推荐结果可以缓存在 CDN

## 相关文档

- MongoDB Connection Pooling: https://www.mongodb.com/docs/manual/administration/connection-pool-overview/
- Mongoose Query Performance: https://mongoosejs.com/docs/queries.html
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
