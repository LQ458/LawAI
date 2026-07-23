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

| 类别                          |  实际结果 | Source / time                          | Definition                                        | Limitation                                               |
| ----------------------------- | --------: | -------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Unit/API/component            | 47 passed | `npm run test:unit`, 2026-07-23        | Jest tests outside `__tests__/integration`        | mocked；不验证真实外部服务                               |
| Authorization/RAG integration |  5 passed | `npm run test:integration`, 2026-07-23 | mocked integration tests                          | mocked Auth0/FGA/Mongo/Pinecone/DeepSeek                 |
| Default Jest total            | 52 passed | `npm test`, 2026-07-23                 | 12 suites / 52 unique tests                       | 不含 Playwright                                          |
| Playwright discovered         |        32 | Playwright `--list`, 2026-07-23        | runtime scenarios in 5 files                      | discovery/review，不是 passing count                     |
| Playwright actually passed    | 10 passed | specs 01/02, 2026-07-23                | 6 anonymous boundary + 4 Auth0 redirect scenarios | remaining 22 authenticated/data/AI/FGA scenarios not run |
| 12-query evaluation           |   not run | external evaluation gate, 2026-07-23   | 12 curated queries with four-dimension LLM judge  | 没有真实分数；不等于律师审核                             |

## Verification commands

| Command                                 | Actual result                              | Limitation / note                                                                                                |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                | passed; 854 packages installed             | local Node 23.9.0 triggered an engine warning from a development lint dependency; CI pins supported Node 20.19.0 |
| `npm run lint`                          | passed; 0 warnings/errors                  | ESLint scope is the repository configuration                                                                     |
| `npm run typecheck`                     | passed                                     | application TypeScript                                                                                           |
| `npx tsc -p e2e/tsconfig.json --noEmit` | passed                                     | E2E/evaluator TypeScript only                                                                                    |
| `npm run test:unit`                     | 11 suites / 47 passed                      | mocked; no live credentials                                                                                      |
| `npm run test:integration`              | 1 suite / 5 passed                         | mocked authorization/RAG services                                                                                |
| `npm test`                              | 12 suites / 52 unique tests passed         | Jest excludes `e2e/`                                                                                             |
| `npm run build`                         | passed; 21 static/dynamic routes generated | local Node emitted a non-fatal experimental type-stripping warning                                               |
| model schema load check                 | passed with no duplicate-index warning     | loads Record, UserActivity, Like, Bookmark and Chat schemas; does not create external indexes                    |
| `npm run audit:prod`                    | 0 production vulnerabilities               | registry result at run time; development deprecations are not production audit findings                          |
| `npm run scan:secrets:working-tree`     | passed; 132 files scanned                  | current committed working tree only                                                                              |
| `npm run scan:secrets`                  | exit 1; two potential history findings     | values intentionally suppressed; see below                                                                       |
| Playwright `--list`                     | 32 scenarios in 5 files                    | discovery only                                                                                                   |
| Playwright specs 01/02                  | 10/10 passed                               | real browser run against local production server; redirect boundary only, not an authenticated callback session  |
| ingestion/seed/FGA `--dry-run` commands | passed; zero external writes               | fixture counts are not production dataset counts                                                                 |
| Pinecone destructive dry run            | planned one namespace delete, writes 0     | no delete executed                                                                                               |
| Pinecone delete without confirmations   | correctly refused before external call     | requires both backup and destructive confirmations                                                               |

### Full-history secret scan

The scanner reported only the following paths/rules:

- `history:README.md: credentialed-mongodb-uri`
- `history:CLAUDE.md: sensitive-env-assignment`

No value was printed or inspected during this report. Whether each match is a real credential remains unverified. If either was ever valid, rotate/revoke it first. Removing it from reachable git history would require an explicitly authorized history rewrite and coordinated force-push; no history rewrite was performed.

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

## Not verified against live services

- Real Auth0 callback and role/permission claim shape;
- real FGA model deployment, token exchange and manager/employee tuple decisions;
- MongoDB metadata category counts and schema migration result;
- MongoDB–Pinecone document ID coverage;
- real DeepSeek grounded answer quality;
- authenticated chat/summary external E2E;
- production-like rate limiting across multiple instances;
- legal accuracy, jurisdictional applicability or lawyer review.

## Deployment and activity evidence

No `.vercel` project metadata or Vercel CLI was present in the repository workspace. No preview was created and no public deployment was inferred.

| Metric                        | Result      | Definition / limitation                                                                                                                              |
| ----------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Web Analytics enabled  | unavailable | no associated project evidence                                                                                                                       |
| Page views                    | unavailable | no analytics window/data                                                                                                                             |
| Unique visitors               | unavailable | no analytics window/data                                                                                                                             |
| Requests/function invocations | unavailable | no project telemetry                                                                                                                                 |
| Error rate                    | unavailable | no project telemetry                                                                                                                                 |
| Registered accounts           | unavailable | no Auth0 tenant aggregate                                                                                                                            |
| Active authenticated accounts | unavailable | no reachable activity store; defined as distinct authenticated Auth0 subjects with rate-limited, client-reported recorded actions in a stated window |

Visitors、page views、requests、registered accounts 和 active authenticated accounts 是不同指标；本报告不相互推算。
