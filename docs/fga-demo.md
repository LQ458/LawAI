# Auth0 FGA Demo — Privacy-Aware RAG

## Scenario

LawAI is an internal legal knowledge assistant. It uses RAG (Pinecone + DeepSeek) to answer questions, but **enforces document-level access** via Auth0 FGA. This means:

- **Alice** (HR Manager) asks about salary adjustments → sees relevant HR documents
- **Bob** (Engineer) asks the same question → gets **access denied** — zero results
- This happens **inside the RAG pipeline**, before the LLM sees the documents

## Architecture

```
User Query → Pinecone Vector Search (top-5)
                ↓
          Auth0 FGA Check (per document)
          "user:alice can viewer on document:xxx?"
                ↓
          Filter: keep only allowed docs
                ↓
          DeepSeek LLM synthesis
                ↓
          Response (or "no accessible documents")
```

## Authorization Model (FGA)

```dsl
type user
type document
  relations
    define viewer: user or viewer from department
type department
  relations
    define member: user
```

## FGA Tuples (Demo)

| Tuple | Meaning |
|-------|---------|
| `user:alice` → `member` → `department:hr` | Alice is in HR department |
| `user:bob` → `member` → `department:engineering` | Bob is in Engineering |
| `department:hr#member` → `viewer` → `document:salary-q4-2025` | HR members can view salary docs |
| `user:*` → `viewer` → `document:labor-law-basics` | Everyone can view public docs |

## Key Files

| File | Purpose |
|------|---------|
| `lib/fga.ts` | FGA client — `fgaCheck()`, `fgaWriteTuples()` |
| `lib/docAccess.ts` | `filterDocsByAccess()` — calls FGA for each doc |
| `lib/demoData.ts` | Demo users, documents, and FGA tuples |
| `app/api/rag-search/route.ts` | RAG pipeline — calls `filterDocsByAccess()` before LLM |
| `scripts/seed-fga.ts` | Seeds FGA tuples into Auth0 store |
| `scripts/demo-fga.ts` | Runnable demo: shows Alice vs Bob access |

## Run the Demo

```bash
# 1. Seed FGA tuples (requires Auth0 FGA credentials in .env.local)
npx tsx scripts/seed-fga.ts

# 2. Run the demo (shows Alice vs Bob side by side)
npx tsx scripts/demo-fga.ts
```

## Expected Output

```
=== Auth0 FGA Access Control Demo ===

[Alice (HR Manager)] Query: 薪资调整方案
  Result: ✅ 5 documents found
  Top docs:
    - 2025年Q4薪资调整方案
    - 员工离职补偿标准
    - 加班政策与补偿标准

[Bob (Engineer)] Query: 薪资调整方案
  Result: ❌ Access Denied
  Message: 根据您的权限，未找到可访问的相关案例。

✅ FGA is correctly blocking Bob from HR-confidential documents
```

## How It Works (Code Walkthrough)

### Step 1: RAG retrieval returns ALL matching documents

`app/api/rag-search/route.ts` — Pinecone returns top-5 matches by vector similarity (no auth):

```typescript
const queryResponse = await mynamespace.query({
  vector: queryEmbedding.values,
  topK: 5,
});
```

### Step 2: FGA filters by user identity

`lib/docAccess.ts` — each document is checked against FGA:

```typescript
export async function filterDocsByAccess(docs, userId) {
  const results = await Promise.all(docs.map(async (doc) => {
    // If doc has sensitivity metadata, check FGA
    if (doc.sensitivity || doc.department) {
      const allowed = await fgaCheck({
        user: `user:${userId}`,
        relation: "viewer",
        object: `document:${doc.id}`,
      });
      return allowed ? doc : null;  // ❌ denied if no FGA tuple
    }
    return doc;  // ✅ allowed if no sensitivity (public)
  }));
  return results.filter(Boolean);
}
```

### Step 3: LLM only sees filtered documents

If all docs are filtered out, the user sees:

```
"根据您的权限，未找到可访问的相关案例。"
```

## Vercel Deployment

For the deployed demo, make sure the FGA environment variables are set:

```
AUTH0_FGA_STORE_ID=01KR67AGXQVMV0QZXQES2FNFEK
AUTH0_FGA_API_URL=https://api.us1.fga.dev
AUTH0_FGA_CLIENT_ID=...
AUTH0_FGA_CLIENT_SECRET=...
```

Then seed the tuples after deployment:

```bash
npx tsx scripts/seed-fga.ts
```
