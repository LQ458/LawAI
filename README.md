# LawAI — Privacy-Aware Legal RAG Bot

AI-powered legal assistant with **Auth0 FGA fine-grained authorization** — sources answers from a document database (RAG) while enforcing document-level access based on user role and department.

> 🏆 Built for the Auth0 FGA challenge: demonstrate that a manager can access salary documents, but a general employee cannot, even if the document is in the RAG index.

## FGA Demo (30 seconds)

```bash
npx tsx scripts/demo-fga.ts
```

See `docs/fga-demo.md` for the full architecture and code walkthrough.

**Expected output:**
```
user:alice can VIEW doc-salary-q4-2025 → ✅ ALLOWED
user:bob   can VIEW doc-salary-q4-2025 → ❌ DENIED
```

## Features

### Privacy-Aware RAG
- Pinecone vector search with built-in inference embedding
- Auth0 FGA filters documents by user role/department before sending to LLM
- Manager vs employee access demo: HR manager sees salary docs, engineer gets denied

### AI Chat
- DeepSeek Chat API for streaming legal Q&A (SSE)
- System prompt tuned for Chinese migrant worker legal assistance
- Asks for specific details before giving advice (time, location, employer, evidence)

### Text Summarization
- DeepSeek-powered inline summary dialog — no separate page needed
- Accessible from main chat and recommendation pages

### Admin Dashboard
- `/admin` — user activity tracking (DAU, top users, query volume)
- Activity scoring: logins × 10 + queries × 5 + interactions × 1
- Charts, tables, recent activity feed

### Authentication
- Auth0 Universal Login — polished OAuth flow with social login support
- Server-side session management via `@auth0/nextjs-auth0@4.x`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15, React 19, TypeScript |
| Auth | Auth0 (`@auth0/nextjs-auth0@4`) |
| Authorization | Auth0 FGA (fine-grained document access) |
| AI Chat | DeepSeek Chat API (OpenAI SDK) |
| Embeddings | Pinecone Inference (`multilingual-e5-large`) |
| Vector DB | Pinecone |
| Database | MongoDB (Mongoose) |
| UI | PrimeReact + TailwindCSS |

## Quick Start

```bash
git clone https://github.com/LQ458/LawAI.git
cd LawAI
npm install
cp .env.local.example .env.local   # then fill in real values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.local.example` for the full template. Key variables:

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` | Auth0 application credentials |
| `AUTH0_SECRET` | 64-char random string for session encryption |
| `AUTH0_FGA_STORE_ID` / `AUTH0_FGA_CLIENT_ID` / `AUTH0_FGA_CLIENT_SECRET` | Auth0 FGA credentials |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `MONGODB_URL` | MongoDB connection string |
| `PINECONE_API_KEY` / `HOST_ADD` | Pinecone vector database |
| `PINECONE_EMBEDDING_MODEL` | Embedding model (default: `multilingual-e5-large`) |

## Project Structure

```
LawAI/
├── app/
│   ├── admin/                  # Admin dashboard
│   ├── api/
│   │   ├── admin/activity/     # Activity stats API
│   │   ├── cases/              # Case listing, like, bookmark
│   │   ├── chromadbtest/       # RAG search + FGA filter
│   │   ├── fetchAi/            # Streaming AI chat
│   │   ├── getCase/            # MongoDB text search
│   │   ├── getChats/           # Chat history
│   │   ├── deleteChat/         # Delete chat
│   │   ├── updateChatTitle/    # Rename chat
│   │   ├── recommend/          # Recommendation engine
│   │   ├── summary/            # Text summarization (DeepSeek)
│   │   └── user-action/        # User interaction tracking
│   ├── recommend/              # Case recommendation page
│   └── page.tsx                # Main chat page
├── components/
│   ├── AuthForm.tsx            # Auth0 login/signup dialog
│   ├── ChatComponent.tsx       # Chat bubble + RAG results
│   ├── ChatHeader.tsx          # Sidebar header
│   ├── ChatList.tsx            # Chat list
│   ├── SummaryDialog.tsx       # Inline summarization modal
│   └── ...
├── lib/
│   ├── auth0.ts                # Auth0 client init
│   ├── fga.ts                  # FGA check/write utilities
│   ├── docAccess.ts            # Document access filter
│   ├── demoData.ts             # Demo users/documents/FGA tuples
│   └── mongodb.ts              # MongoDB connection
├── models/                     # Mongoose schemas
├── hooks/                      # Custom React hooks
├── e2e/                        # Playwright E2E tests + AI evaluator
│   ├── specs/                  # 32 test cases (5 specs)
│   ├── evaluator/              # AI judge scoring pipeline
│   └── report/                 # Report generator
├── docs/
│   ├── testing-procedure.md    # Full testing documentation
│   └── safety-guidelines.md    # Legal AI safety standards
└── scripts/
    └── seed-fga.ts             # Seed FGA tuples for demo
```

## E2E Testing

```bash
npm run test:e2e        # All 32 Playwright tests
npm run test:e2e:ui     # Interactive UI mode
npm run test:ai         # AI evaluation pipeline (queries → DeepSeek judge → report)
```

See `docs/testing-procedure.md` for full details.

## FGA Access Control Demo

The RAG pipeline enforces document-level access:

| User | Role | Query | Result |
|------|------|-------|--------|
| Alice | HR Manager | 薪资调整 | Sees salary docs |
| Bob | Engineer | 薪资调整 | Access denied |
| Charlie | Legal/Finance | 财务报表 | Sees budget docs |
| Anonymous | — | 薪资调整 | Only public docs |

FGA authorization model:
```
type user
type document
  relations
    define viewer: user or viewer from department
type department
  relations
    define member: user
```

Seed demo data: `npx tsx scripts/seed-fga.ts`

## AI Evaluation Framework

The `e2e/evaluator/` pipeline uses DeepSeek as a judge to score AI responses across 4 categories:

| Category | Weight | What |
|----------|--------|------|
| Safety | 40% | No harmful/illegal advice, disclaimers present |
| Specificity | 25% | Asks for details first, cites correct laws |
| Actionability | 20% | Concrete steps, official contact info |
| Clarity | 15% | Accessible language, clear structure |

12 curated legal queries covering workplace injury, wage disputes, contracts, social insurance, overtime, severance, and more.

See `docs/safety-guidelines.md` for the full safety rubric.

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel (auto-detects Next.js)
3. Set all environment variables from `.env.local.example`
4. Add `https://<your-domain>/auth/callback` to Auth0 allowed callback URLs
5. Deploy

## License

MIT
