# LawAI

LawAI 是一个 privacy-aware legal RAG technical prototype，用于验证 Auth0 会话身份、Auth0 FGA 文档授权、Pinecone 候选检索、MongoDB 权威元数据和 DeepSeek 生成之间的安全边界。

它不是公开法律服务，不提供正式法律意见，也没有经过律师审核、专业法律准确性验证或生产安全认证。法律和程序会随地区与时间变化；高风险事项应核对当地最新官方资料，并咨询合格律师、官方法律援助机构或相关主管部门。

## 当前边界

- 普通聊天：`POST /api/fetchAi`，需要 Auth0 会话。该路径没有检索资料，回复不得描述为 RAG-grounded。
- Grounded RAG：`POST /api/rag-search`，请求体仅接受有长度限制的 `{ "query": "..." }`。客户端提供的 `userId` 不参与身份或授权。
- 文档可见性：只有显式 `visibility: public` 的记录可匿名访问。缺失或非法 metadata 不会被推断为 public。
- Restricted 文档：必须包含稳定 `documentId`、`department`、`sensitivity` 和 raw `fgaObjectId`。FGA 未配置、token 失败、超时或响应异常时 fail closed。
- FGA model：restricted check 前会确认 store 中恰好存在一个与仓库模型语义一致的 authorization model，并把 check 显式绑定到该 model ID；空、冲突或多个 model 均 fail closed。
- 检索顺序：Pinecone 只返回候选 ID；MongoDB 提供权威授权 metadata 和受控长度内容；FGA 过滤完成后，获准内容才会进入 DeepSeek context。
- 来源：grounded response 只返回获准的结构化 sources，并要求答案使用 `[DOC:documentId]` 引用。证据不足时返回明确的信息不足说明。
- Chat ownership：读取、更新和删除都同时绑定 MongoDB chat ID 与当前 Auth0 subject。
- Admin：`/admin` 和 `/api/admin/activity` 在服务端检查 Auth0 permission、role 或显式管理员 subject allowlist；未登录为 401，已登录非管理员为 403。
- 活动数据：只接受有频率与大小限制的 client-reported allowlist action/metadata，不保存 prompt、法律问题正文、模型回复、token 或 email。`activeUsers` 定义为指定窗口内提交过获准记录行为的 distinct authenticated Auth0 subjects；它不是 registered accounts、visitors 或独立分析平台的 DAU。

## 架构

| 层                     | 实现                                 |
| ---------------------- | ------------------------------------ |
| Web                    | Next.js 15、React 19、TypeScript     |
| Authentication         | Auth0 server-side session            |
| Document authorization | Auth0 FGA                            |
| Candidate retrieval    | Pinecone Inference + namespace query |
| Authoritative records  | MongoDB + Mongoose                   |
| Generation             | DeepSeek via OpenAI SDK              |
| UI                     | PrimeReact + Tailwind CSS            |

Grounded RAG 的安全顺序是：

```text
POST query
  -> Auth0 server session
  -> Pinecone candidate IDs
  -> MongoDB authorization metadata only
  -> explicit-public or FGA viewer check
  -> MongoDB content for authorized IDs only
  -> bounded authorized context
  -> DeepSeek answer
  -> authorized-only sources
```

Auth0 subject 使用服务端统一映射为 FGA user object；该值不能由请求 query、header 或 body 指定。可部署的 FGA API JSON 位于 `fga/model.json`，对应 DSL 位于 `fga/model.fga`。

## 本地启动

```bash
git clone https://github.com/LQ458/LawAI.git
cd LawAI
npm ci
cp .env.local.example .env.local
npm run dev
```

`.env.local.example` 只包含 placeholder。不要提交真实 secret、连接字符串、Auth0 subject、cookie 或 token。

主要配置：

| 类别     | 变量                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| Auth0    | `APP_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` |
| Admin    | `AUTH0_ADMIN_PERMISSION`, `AUTH0_ADMIN_ROLE`, claim names；可选 `ADMIN_AUTH0_SUBJECTS`   |
| FGA      | API URL、token issuer、audience、store/client credentials、timeout                       |
| MongoDB  | `MONGODB_URL`, `MONGODB_AUTO_INDEX`                                                      |
| Pinecone | API key, host, index, namespace, embedding model                                         |
| DeepSeek | `DEEPSEEK_API_KEY`, `AI_MODEL`                                                           |

## 数据与 ingestion

`Record` 明确区分：

- `visibility`: `public | restricted`
- `sourceKind`: `source-derived | synthetic`
- provenance: `source`, `sourceUrl`, `version`
- authorization: `documentId`，以及 restricted 所需的 `department`, `sensitivity`, `fgaObjectId`

CAIL2018 loader 将 source-derived 数据标注为 CAIL2018 并保留数据集来源 URL；它不等于本项目对数据许可或法律准确性作出额外保证。生成脚本只创建明确标注的 synthetic/example cases，不将其描述为真实裁判案例；合成数据的 views/likes/bookmarks 不作为真实用户指标。

安全的数据命令：

```bash
# 默认只读，只输出分类数量
npm run data:migrate:dry-run

# 只读聚合，不输出正文、标题或 ID
npm run data:evidence

# 查看 ingestion 参数；支持 dry-run、batch、resume、checkpoint
npx tsx scripts/ingest-pinecone.ts --help
```

Migration 的 `--apply` 只写 MongoDB metadata；Pinecone 重新同步是独立步骤。namespace delete/clear 必须同时提供 destructive confirmation 和 backup acknowledgement；不要在未备份、未明确授权时清空 production namespace。

Migration 只把有可信 CAIL2018 provenance 或已有显式 public 标记的已识别记录归为 public。仅匹配旧 CAIL/synthetic 数据形态但缺少显式可见性或可信 provenance 的记录保持 `restricted` 并标记 `needsReview`；已有 `restricted` 永不被降级。

## 测试

2026-07-23 在本地执行的 mocked/default suites：

| 命令                       | 实际结果                          |
| -------------------------- | --------------------------------- |
| `npm run test:unit`        | 12 suites，53 tests passed        |
| `npm run test:integration` | 1 suite，5 tests passed           |
| `npm test`                 | 13 suites，58 unique tests passed |

这些测试不依赖真实 Auth0、FGA、MongoDB、Pinecone 或 DeepSeek credential。覆盖伪造 `userId`、explicit-public anonymous access、restricted allow/deny、FGA fail-closed、denied context exclusion、authorized-only citations、chat ownership、admin 403、输入边界和外部服务错误。

Playwright 当前可发现 32 个场景。本次实际运行并通过了 10 个浏览器场景：6 个 anonymous UI/API boundary 和 4 个 Auth0 login/logout redirect boundary。其余 22 个需要 MongoDB、DeepSeek、受控 Auth0 session 或 FGA fixtures，本次没有运行，不能计为 passing。详见 `docs/testing-procedure.md`。

配置指向的 FGA store 已完成 token exchange、只读 model 查询、一次空-store model 创建和写后验证；当前恰好一个所需 model。未写入用户/department/document tuple，也没有 manager/employee session，因此这不等于 restricted allow/deny E2E 已通过。

## 12-query automated evaluation

`e2e/` 保留 12 个 curated legal-information test queries，按 safety、specificity、actionability、clarity 四个维度由 LLM judge 自动评分。报告记录日期、answer/judge model、prompt/rubric/dataset version 和逐项结果，但不保存原始用户 prompt 或模型回复。

Automated evaluation 不等于律师审核。本次没有运行 12-query evaluation，因此仓库不展示示例分数为真实结果。

## 验证与证据

- 测试流程：`docs/testing-procedure.md`
- FGA 模型与 demo：`docs/fga-demo.md`
- 法律信息与 evaluation 边界：`docs/safety-guidelines.md`
- 本次无个人数据 evidence report：`docs/evidence-report-2026-07-23.md`

## 部署

仓库当前没有已关联的本地 Vercel project metadata，因此本次未创建 preview，也没有可验证的公开 deployment、Web Analytics 或 traffic/account metrics。若以后关联项目，只应先创建 preview，配置 Auth0 callback，并验证 public retrieval、restricted allow/deny、chat ownership 和 admin 403；不要未经明确授权把它公开部署为法律咨询服务。

## License

MIT
