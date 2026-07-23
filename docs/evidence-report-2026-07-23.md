# LawAI maintenance evidence report — 2026-07-23

本报告只包含聚合值、命令结果和限制，不包含查询、对话、标题、文档 ID、邮箱、Auth0 subject、cookie、token、环境变量值或其他个人数据。时间定义为 2026-07-23（Asia/Singapore）。

## Data evidence

| 指标                         |        结果 | Source / time                                | Definition                                    | Limitation                                                                   |
| ---------------------------- | ----------: | -------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| MongoDB records              | unavailable | `npm run data:evidence`, 2026-07-23          | configured `records` collection count         | MongoDB endpoint DNS resolution failed (`ENOTFOUND`); hostname/value omitted |
| Pinecone index vectors       |         150 | read-only `describeIndexStats`, 2026-07-23   | all vectors in configured index               | 只代表调用时的 index stats                                                   |
| Pinecone namespace vectors   |         150 | read-only `describeIndexStats`, 2026-07-23   | vectors in configured namespace               | namespace name omitted；可能随外部写入变化                                   |
| Pinecone enumerated IDs      |         150 | read-only `listPaginated`, 2026-07-23        | unique IDs enumerated in configured namespace | ID 只在内存比较，不写入报告                                                  |
| Public records               | unavailable | MongoDB aggregate planned, 2026-07-23        | `visibility == public`                        | MongoDB unreachable                                                          |
| Restricted records           | unavailable | MongoDB aggregate planned, 2026-07-23        | `visibility == restricted`                    | MongoDB unreachable                                                          |
| Synthetic records            | unavailable | MongoDB aggregate planned, 2026-07-23        | `sourceKind == synthetic`                     | MongoDB unreachable                                                          |
| Source-derived records       | unavailable | MongoDB aggregate planned, 2026-07-23        | `sourceKind == source-derived`                | MongoDB unreachable                                                          |
| MongoDB–Pinecone ID coverage | unavailable | in-memory set comparison planned, 2026-07-23 | intersection / unique MongoDB document IDs    | MongoDB IDs unavailable；未估算                                              |

Pinecone `listPaginated` 不返回完整 vector metadata，因此 Pinecone 内部的 public/restricted/synthetic 分类数量没有可靠证据，写为 unavailable。

## Migration dry run

执行：

```text
npm run data:migrate:dry-run
```

结果：在读取 records 前因 MongoDB DNS resolution failure 退出，exit code 1；没有产生 metadata 分类数量，没有写入 MongoDB 或 Pinecone，也没有清空 namespace。Failure output 未包含连接字符串、记录或 document ID。

Migration 的预期分类区分 trusted CAIL2018 public、explicit public synthetic、recognized source、preserved restricted、unverified legacy CAIL/synthetic candidates（保持 restricted）和其他 needs-review。只有 MongoDB 可访问后重新执行 dry run，才能把分类数量写成证据。

## Test evidence

| 类别                               |  实际结果 | Source / time                            | Definition                                        | Limitation                                            |
| ---------------------------------- | --------: | ---------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Unit/API/component                 | 61 passed | `npm run test:unit`, 2026-07-23          | Jest tests outside `__tests__/integration`        | mocked；不验证真实外部服务                            |
| Authorization/RAG integration      |  5 passed | `npm run test:integration`, 2026-07-23   | mocked integration tests                          | mocked Auth0/FGA/Mongo/Pinecone/DeepSeek              |
| Default Jest total                 | 66 passed | `npm test`, 2026-07-23                   | 14 suites / 66 unique tests                       | 不含 Playwright                                       |
| Playwright discovered              |        32 | Playwright `--list`, 2026-07-23          | runtime scenarios in 5 files                      | discovery/review，不是 passing count                  |
| Playwright configured-env evidence | 10 passed | external acceptance evidence, 2026-07-23 | 6 anonymous boundary + 4 Auth0 redirect scenarios | 不在 CI 中执行；不验证 authenticated callback session |
| Playwright placeholder rerun       |      9/10 | external acceptance evidence, 2026-07-23 | same 10 boundary scenarios                        | placeholder tenant 无法完成 provider discovery        |
| 12-query evaluation                |   not run | external evaluation gate, 2026-07-23     | 12 curated queries with four-dimension LLM judge  | 没有真实分数；不等于律师审核                          |

## Verification commands

| Command                                 | Actual result                              | Limitation / note                                                                                                |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                | passed; 854 packages installed             | local Node 23.9.0 triggered an engine warning from a development lint dependency; CI pins supported Node 20.19.0 |
| `npm run lint`                          | passed; 0 warnings/errors                  | ESLint scope is the repository configuration                                                                     |
| `npm run typecheck`                     | passed                                     | application TypeScript                                                                                           |
| `npx tsc -p e2e/tsconfig.json --noEmit` | passed                                     | E2E/evaluator TypeScript only                                                                                    |
| `npm run test:unit`                     | 13 suites / 61 passed                      | mocked; no live credentials                                                                                      |
| `npm run test:integration`              | 1 suite / 5 passed                         | mocked authorization/RAG services                                                                                |
| `npm test`                              | 14 suites / 66 unique tests passed         | Jest excludes `e2e/`                                                                                             |
| `npm run build`                         | passed; 21 static/dynamic routes generated | local Node emitted a non-fatal experimental type-stripping warning                                               |
| model schema load check                 | passed with no duplicate-index warning     | loads Record, UserActivity, Like, Bookmark and Chat schemas; does not create external indexes                    |
| `npm run audit:prod`                    | 0 production vulnerabilities               | registry result at run time; development deprecations are not production audit findings                          |
| `npm run scan:secrets:working-tree`     | passed; 139 files scanned                  | current working tree                                                                                             |
| `npm run scan:secrets`                  | passed; 139 files / 506 history blobs      | pre-commit history snapshot; structural pattern scan; values intentionally suppressed                            |
| Playwright `--list`                     | 32 scenarios in 5 files                    | discovery only                                                                                                   |
| Playwright specs 01/02                  | configured env 10/10; placeholder env 9/10 | external evidence; not run by CI; placeholder failure is provider discovery                                      |
| ingestion/seed/FGA `--dry-run` commands | passed; zero external writes               | fixture counts are not production dataset counts                                                                 |
| `npm run fga:model:status`              | passed; 1 model / ready                    | live read-only aggregate; identifiers omitted                                                                    |
| `npm run fga:model:apply`               | passed as zero-write no-op after creation  | live store has exactly one required model; no tuple read/write                                                   |
| Pinecone destructive dry run            | planned one namespace delete, writes 0     | no delete executed                                                                                               |
| Pinecone delete without confirmations   | correctly refused before external call     | requires both backup and destructive confirmations                                                               |

### Full-history secret scan

`npm run scan:secrets` passed across 139 current files and 506 unique reachable history blobs in the pre-commit verification snapshot; later commits can increase the unique-blob count. Two earlier findings were rechecked without displaying their values: the historical README match used placeholder username/password structure, and the historical `CLAUDE.md` match was a simple non-credentialed MongoDB example URI. The scanner now recognizes only complete, structured placeholder values or complete environment references without a path allowlist; adversarial placeholder substrings, arbitrary bracketed values, embedded environment-reference strings, later real URIs in the same file, credential-bearing MongoDB URIs and non-placeholder sensitive assignments remain findings.

This is a bounded pattern scan, not proof that no secret has ever existed. These two placeholder-shaped findings do not justify credential rotation or a history rewrite, and neither action was performed.

## Verified in mocked/local scope

- server-side identity ignores forged client `userId`;
- explicit-public anonymous access and restricted fail-closed behavior;
- allowed/denied restricted document decisions;
- authorization completes before context construction;
- denied title/summary/body exclusion and authorized-only sources/citations;
- chat ownership for read/update/delete;
- normal authenticated user receives admin 403;
- JSON/type/length/upstream error handling;
- ingestion/migration commands expose dry-run, batch, resume/checkpoint and destructive confirmation boundaries.
- explicit restricted synthetic records are preserved by migration; unverified legacy CAIL/synthetic shapes remain restricted/needs-review;
- RAG performs metadata-only lookup and authorization before an authorized-only content query.
- FGA runtime verifies exactly one semantically matching model and pins check/write requests to its model ID.

## Live FGA evidence

The configured FGA endpoint was checked without printing any environment value or identifier:

| Evidence                    | Result                             | Definition / limitation                                                                                  |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Client credential exchange  | passed                             | live token request; token and client identifiers omitted                                                 |
| Initial authorization model | 0 models                           | read-only state immediately before creation                                                              |
| Model creation              | 1 required model created           | one immutable model write; no relationship tuple read/write                                              |
| Final model state           | exactly 1 / semantic state `ready` | service-added empty/default JSON fields are normalized; non-empty extra policy fields still cause unsafe |
| Repeat apply                | passed with 0 external writes      | idempotent no-op because the exact unique model already exists                                           |
| No-tuple deny smoke         | `allowed=false`                    | placeholder subject/object only; not a real manager/employee authorization test                          |

The service accepted the first model write, but the initial local post-write verifier returned exit 1 because it compared service-added semantically empty fields byte-for-byte. A read-only check confirmed exactly one model, the verifier was narrowed to normalize only empty/default service fields, and the final status plus repeat apply passed without a second write. No subject, tuple, store ID, model ID, token or credential was printed or stored in this report.

## Not verified against live services

- Real Auth0 callback and role/permission claim shape;
- real manager/employee subject mapping, relationship tuples and allow/deny decisions;
- MongoDB metadata category counts and schema migration result;
- MongoDB–Pinecone document ID coverage;
- real DeepSeek grounded answer quality;
- completed Auth0 callback on the protected Preview;
- authenticated chat/summary external E2E;
- production-like rate limiting across multiple instances;
- legal accuracy, jurisdictional applicability or lawyer review.

## Deployment and activity evidence

At 2026-07-23 19:33 +08, Vercel CLI listed two READY Preview deployments for the maintenance branch. Project protection applies SSO to all previews; these deployments are access-protected, not public, and not production. `vercel.json` disables Git-triggered deployment from `main`, so merging does not authorize or initiate a production deployment.

Protected Preview smoke results:

| Check                          | Result  | Definition / limitation                                                       |
| ------------------------------ | ------- | ----------------------------------------------------------------------------- |
| `/`                            | 200     | authenticated protection bypass; prototype/legal-information boundary visible |
| `/admin`                       | 401     | anonymous request                                                             |
| `/api/admin/activity`          | 401     | anonymous request                                                             |
| GET `/api/rag-search`          | 405     | POST-only boundary                                                            |
| malformed JSON RAG POST        | 400     | request validation                                                            |
| anonymous public RAG POST      | 502     | request reached the app; MongoDB upstream unavailable                         |
| Auth0 login/callback discovery | blocked | redirect origin corrected; provider callback allowlist still rejects Preview  |

| Metric                        | Result      | Source / window / definition / limitation                                                                                                            |
| ----------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Web Analytics enabled  | yes         | read-only project settings, 2026-07-23 19:33 +08; enabled does not imply traffic data                                                                |
| Page views                    | 0 returned  | `vercel.analytics_pageview.count`, 2026-07-22T11:33:06Z–2026-07-23T11:33:06Z; protected/bot smoke traffic may not be counted                         |
| Unique visitors               | 0 returned  | unique `visitor_id` over the same 24-hour window; distinct from page views and accounts                                                              |
| Requests/function invocations | unavailable | observability metric query required an unavailable paid capability; not estimated                                                                    |
| Error rate                    | unavailable | request/invocation counts were unavailable, so no denominator or rate was inferred                                                                   |
| Registered accounts           | unavailable | no Auth0 tenant aggregate                                                                                                                            |
| Active authenticated accounts | unavailable | no reachable activity store; defined as distinct authenticated Auth0 subjects with rate-limited, client-reported recorded actions in a stated window |

Visitors、page views、requests、registered accounts 和 active authenticated accounts 是不同指标；本报告不相互推算。
