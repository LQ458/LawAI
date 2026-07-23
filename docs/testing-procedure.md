# LawAI testing procedure

默认 CI 使用 mocked、deterministic tests，不需要真实 DeepSeek、Pinecone、MongoDB、Auth0 或 FGA credential。真实服务与浏览器场景属于 optional external suites。

## 默认验证

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm test
npm run build
npm run audit:prod
npm run scan:secrets:working-tree
```

Jest 的 `testMatch` 只收集 `__tests__`，显式排除 `e2e/`。

2026-07-23 的实际本地结果：

| Suite                                | 命令                       | 结果                              |
| ------------------------------------ | -------------------------- | --------------------------------- |
| Unit/API/component                   | `npm run test:unit`        | 12 suites，53 passed              |
| Mocked authorization/RAG integration | `npm run test:integration` | 1 suite，5 passed                 |
| Default Jest total                   | `npm test`                 | 13 suites，58 unique tests passed |

重点断言：

- 请求体伪造 `userId` 不改变 server-side identity；
- anonymous 只看到 explicit public records；
- allowed subject 可读取同一 restricted fixture，denied subject 不可读取；
- FGA 未配置、token 失败或异常时 restricted fail closed；
- FGA token issuer/audience、唯一模型语义验证和显式 model-ID pin；
- denied 标题、摘要和正文不进入 model context 或 sources；
- RAG answer 只能引用获准 document IDs；
- chat 读取、更新、删除绑定当前 owner；
- 普通登录用户访问 admin activity 得到 403；
- 非法 JSON、错误类型、长度超限和 upstream failure 返回受控状态。

## Playwright external suite

发现命令：

```bash
npx playwright test --config=e2e/playwright.config.ts --list
```

当前发现 5 个 spec 文件、32 个场景：

| Spec                    | 场景数 | 说明                                                                   |
| ----------------------- | -----: | ---------------------------------------------------------------------- |
| `01-unauth.spec.ts`     |      6 | anonymous UI/API boundary                                              |
| `02-auth-flow.spec.ts`  |      4 | Auth0 login/logout redirect boundary                                   |
| `03-chat-ai.spec.ts`    |     12 | 12 curated queries，需要 authenticated session 与 DeepSeek             |
| `04-fga-access.spec.ts` |      4 | manager allowed、employee denied、anonymous public-only、forged userId |
| `05-api-direct.spec.ts` |      6 | API smoke checks，部分需要 session/external services                   |

运行：

```bash
npm run test:e2e:external
```

按场景提供的 fixture 包括 `E2E_AUTH_COOKIE`、manager/employee cookies、restricted query/document ID 和 public query。Cookie 和 Auth0 subject 不得写入仓库、报告、trace 或截图。没有这些 fixture 时相关场景会 skip，不能计为 passing。

本次维护执行了全部场景的 `--list`，并实际运行：

```bash
npx playwright test --config=e2e/playwright.config.ts \
  e2e/specs/01-unauth.spec.ts \
  e2e/specs/02-auth-flow.spec.ts
```

结果为 10/10 passed：6 个 anonymous UI/API boundary 加 4 个 Auth0 login/logout redirect boundary。其余 22 个 authenticated/data/AI/FGA 场景未运行，不能计为 passing。

## 12-query automated evaluation

运行入口：

```bash
RUN_EXTERNAL_EVALUATION=1 EVALUATION_AUTH_COOKIE=<session-cookie> npm run test:ai:external
```

Fixture 是 12 个 curated legal-information test queries。Rubric 有四个维度：

- safety
- specificity
- actionability
- clarity

报告记录 run date、answer model、judge model、prompt version、rubric version、dataset version 和每项分数。Reporter 不保存原始 prompt、原始回复或个人数据。LLM judge 是 automated evaluation，不等于律师审核；其结果可能不稳定，也不能证明法律准确性或生产安全。

本次没有真实运行 12-query evaluation，因此没有实际分数或 pass count。

## CI

`.github/workflows/ci.yml` 执行 clean install、lint、typecheck、unit、mocked integration、production build、production dependency audit 和 secret scan。

Working-tree secret scan 适合阻止新 credential 进入提交。Full-history scan 还会检查过去提交；若命中疑似 credential，只报告文件路径和 rule，不输出值。Secret 轮换、撤销或 git history rewrite 需要单独确认，不能由测试自动完成。
