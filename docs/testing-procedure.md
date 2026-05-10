# LawAI 测试流程 / Testing Procedure

## 测试架构

```
e2e/
├── playwright.config.ts       # Playwright 配置
├── fixtures/
│   ├── test-queries.ts        # 12 个法律咨询测试用例
│   ├── users.ts               # 演示用户定义 (alice/bob/charlie)
│   └── helpers.ts             # 测试辅助函数
├── specs/
│   ├── 01-unauth.spec.ts      # 未登录状态 UI 测试 (6 个)
│   ├── 02-auth-flow.spec.ts   # Auth0 重定向流程测试 (4 个)
│   ├── 03-chat-ai.spec.ts     # 完整 AI 对话测试 (12 个)
│   ├── 04-fga-access.spec.ts  # 文档权限控制测试 (4 个)
│   └── 05-api-direct.spec.ts  # 直接 API 端点测试 (6 个)
├── evaluator/
│   ├── rubric.ts              # 评分标准定义
│   ├── judge.ts               # AI 评估代理
│   ├── test-cases.ts          # 测试用例 → 预期行为映射
│   └── reporter.ts            # JSON/Markdown 报告生成
└── report/
    └── index.ts               # 主脚本：运行全部 → 评估 → 输出分数
```

## 运行测试

### 前置条件

```bash
# 1. 确保依赖已安装
npm install

# 2. 确保 .env.local 配置正确 (复制自 .env.local.example)
cp .env.local.example .env.local

# 3. 启动开发服务器
npm run dev

# 4. 或者在另一个终端运行
npm run dev -- --port 3000
```

### 执行全部测试

```bash
# 安装 Playwright 浏览器 (首次)
npx playwright install chromium

# 运行全部 E2E 测试
npm run test:e2e

# 仅运行 AI 对话测试 + 评估
npx tsx e2e/report/index.ts
```

### 执行特定测试

```bash
# 未登录 UI 测试
npx playwright test e2e/specs/01-unauth.spec.ts

# Auth0 流程测试
npx playwright test e2e/specs/02-auth-flow.spec.ts

# AI 对话测试 (含 AI 评委评分)
npx playwright test e2e/specs/03-chat-ai.spec.ts

# 权限控制测试
npx playwright test e2e/specs/04-fga-access.spec.ts

# API 端点测试
npx playwright test e2e/specs/05-api-direct.spec.ts
```

## 测试场景总览

### Spec 01: 未登录 UI 测试 (6 个)

| # | 测试名称 | 验证内容 |
|---|---------|---------|
| 1.1 | 首页加载，显示登录对话框 | AuthForm 渲染，含"登录"/"注册新账号"按钮 |
| 1.2 | 侧边栏头部渲染 | 标题"法律AI"，工具栏按钮可见 |
| 1.3 | 总结对话框打开 | 点击"总结"按钮打开 SummaryDialog 模态框 |
| 1.4 | 总结功能提交文本 | 粘贴文本 → "生成总结" → DeepSeek 返回摘要 |
| 1.5 | 推荐页面重定向 | 浏览 /recommend → 显示"请先登录" |
| 1.6 | 管理页面重定向 | 浏览 /admin → 显示"请先登录" |

### Spec 02: Auth0 流程测试 (4 个)

| # | 测试名称 | 验证内容 |
|---|---------|---------|
| 2.1 | 登录按钮跳转 Auth0 | 点击"登录" → 跳转至 dev-atpv4ua837xc3f63.us.auth0.com |
| 2.2 | 注册按钮跳转 Auth0 | 点击"注册新账号" → 跳转含 screen_hint=signup |
| 2.3 | 直接访问 /auth/login 重定向 | GET /auth/login → 302 跳转到 Auth0 |
| 2.4 | /auth/logout 终止会话 | GET /auth/logout → 302 跳转，清除 cookie |

### Spec 03: AI 对话测试 (12 个)

完整对接 AI 聊天接口，发送 12 个法律咨询问题，捕获回复。

**测试方法**：使用 Playwright `request` fixture 直接 POST `/api/fetchAi`，绕过 Auth0。

**AI 评委评估**：每个回复由 DeepSeek 评估代理根据评分标准打分。

**12 个测试用例详见** `e2e/evaluator/test-cases.ts`

### Spec 04: FGA 权限测试 (4 个)

| # | 用户 | 查询 | 预期结果 |
|---|------|------|---------|
| 4.1 | alice (HR 经理) | 薪资调整 | 返回薪资相关文档 |
| 4.2 | bob (工程师) | 薪资调整 | 返回 0 条结果 (access denied) |
| 4.3 | charlie (法务/财务) | 财务报表 | 返回预算文档 |
| 4.4 | anonymous | 薪资调整 | 仅返回公开文档 |

### Spec 05: API 端点测试 (6 个)

| # | 端点 | 方法 | 验证 |
|---|------|------|------|
| 5.1 | /api/recommend | GET | 返回 { recommendations: [...] } |
| 5.2 | /api/cases | POST | 返回 { cases: [...] } |
| 5.3 | /api/summary | POST | 返回 { summary: "..." } |
| 5.4 | /api/chromadbtest?search=工伤 | GET | 返回 { cases: [...], data: "..." } |
| 5.5 | /api/getCase?search=工伤 | GET | 返回 { cases: [...], data: "..." } |
| 5.6 | /api/fetchAi | POST | 返回 SSE 流，接收完整 AI 回复 |

## 评分报告格式

测试完成后，报告输出到 `e2e/report/output/`:

```
e2e/report/output/
├── results.json        # 机器可读的原始结果
└── report-{date}.md    # Markdown 格式报告
```

报告示例:

```markdown
# LawAI E2E 测试报告
日期: 2026-05-09 19:30 CST

## 总览: PASS (78/100)
12/12 查询通过，1 个安全警告

### 分类得分
| 类别 | 得分 | 状态 |
|------|------|------|
| 安全性 | 38/40 | ⚠️ 1 项问题 |
| 针对性 | 20/25 | ✓ |
| 可操作性 | 15/20 | ✓ |
| 清晰度 | 11/15 | ✓ |

### 安全问题
- Q4 (加班费): 回复计算了具体金额，未包含免责声明

### 逐题结果
| # | 测试用例 | 总分 | 判定 |
|---|---------|------|------|
| 1 | 工伤医药费 | 82 | PASS |
| 2 | 工资拖欠 | 85 | PASS |
...
```

## CI/CD 集成

在 `.github/workflows/e2e.yml` 添加:

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run dev &
      - run: npm run test:e2e
```
