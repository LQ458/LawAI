# Auth0 FGA document-authorization demo

本文档描述当前代码的可验证权限边界。Demo 数据是 synthetic access-control fixtures，不是真实裁判案例、真实员工资料或真实使用记录。

## Authorization model

仓库中的 `fga/model.fga` 是便于阅读的 DSL；`fga/model.json` 是 API 可部署版本。应用和 demo tuple 使用同一模型：

```fga
model
  schema 1.1

type user

type department
  relations
    define member: [user]

type document
  relations
    define viewer: [user, department#member]
```

Public 文档由应用层的显式 `visibility: public` 决定，不需要 public/wildcard FGA tuple。Restricted 文档需要完整 metadata，并通过 `viewer` check。

## 身份映射

应用只接受 Auth0 server-side session 中的 `session.user.sub`。`lib/fgaIdentity.ts` 将其稳定映射为：

```text
user:auth0_<base64url(Auth0 subject)>
```

客户端请求中的 `userId`、header 或 query 参数不能改变该映射。Live demo seed 必须从环境变量读取由管理员确认的 Auth0 subjects；脚本不打印这些值。

## RAG 授权顺序

```text
POST /api/rag-search JSON query
  -> server-side Auth0 identity
  -> Pinecone candidate IDs
  -> MongoDB authoritative authorization metadata only
  -> public bypass OR restricted FGA check
  -> MongoDB bounded content for authorized IDs only
  -> authorized-only bounded context
  -> DeepSeek
  -> authorized-only answer sources
```

被拒绝文档的标题、摘要、链接和正文都不会进入模型 context 或 API sources。FGA store/client 配置缺失、token 获取失败、超时、非 2xx 或 malformed response 时，restricted 文档被拒绝。Public 文档不调用 FGA。

## Demo metadata and tuples

`lib/demoData.ts` 中的 public/restricted fixtures 都有稳定 document ID 和 synthetic provenance。Restricted tuple 形态如下，值仅为 placeholder 示例：

```text
user:auth0_<mapped-manager> member department:hr
department:hr#member viewer document:<restricted-document-id>
```

Employee subject 可映射到另一个 department；对同一 HR restricted document 应得到 denied。是否实际 allowed 取决于已部署的 model、store tuple 和对应 Auth0 session，不能只从脚本存在推断。

## 安全运行

先执行零网络、零写入 dry run：

```bash
npx tsx scripts/seed-fga.ts --dry-run
npx tsx scripts/demo-fga.ts --dry-run
```

FGA model 状态是只读操作。`--apply` 只允许空 store 创建一次模型；非空不匹配、多个模型或写入前状态变化都会拒绝。脚本不输出 store/model ID 或 credential，也不读取或写入 tuple：

```bash
npm run fga:model:status
npm run fga:model:apply
```

Live tuple seed 需要：

```text
AUTH0_FGA_API_URL=https://api.<jurisdiction>.fga.dev
AUTH0_FGA_TOKEN_ISSUER=auth.fga.dev
AUTH0_FGA_AUDIENCE=https://api.<jurisdiction>.fga.dev/
AUTH0_FGA_STORE_ID=<store-id>
AUTH0_FGA_CLIENT_ID=<client-id>
AUTH0_FGA_CLIENT_SECRET=<client-secret>
DEMO_MANAGER_AUTH0_SUBJECT=<server-verified-subject>
DEMO_EMPLOYEE_AUTH0_SUBJECT=<server-verified-subject>
```

可选 `DEMO_LEGAL_FINANCE_AUTH0_SUBJECT`。不要把 subject、credential、cookie 或 store identifier 提交到仓库或测试报告。

```bash
npx tsx scripts/seed-fga.ts --batch-size=25
npx tsx scripts/demo-fga.ts
```

Seed 支持 batch、resume 和 checkpoint；checkpoint 不保存 subject 值。RAG endpoint demo 使用 POST JSON。只有设置 `DEMO_AUTH_COOKIE` 时才以该 cookie 对应的当前 server session 请求；脚本不接受模拟 `userId`。

## 可选真实服务 E2E

`e2e/specs/04-fga-access.spec.ts` 要求两个真实、非共享 session 和一个已知 restricted fixture：

- manager session 的 sources 包含目标 restricted document ID；
- employee session 的 sources 不包含同一 ID；
- anonymous sources 不包含 restricted ID；
- anonymous body 中伪造 `userId` 不能提升权限。

这些断言只有实际运行并通过后才能描述为 passing E2E。本次维护只完成场景发现与代码核对，未提供真实 session，因此没有运行该外部 suite。

2026-07-23 的 live、无个人数据检查确认：client credential token exchange 成功；store 初始为空；所需 authorization model 创建后只读状态为 `models=1 / ready`；再次 apply 为零写入 no-op；placeholder subject/object 的无 tuple check 返回 denied。没有创建 manager/employee subject mapping 或任何 relationship tuple，因此仍不能声称 manager allowed / employee denied 已通过。
