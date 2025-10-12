# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Use pnpm as the package manager:
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm test` - Run Jest tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage

## Architecture

This is a Next.js 15 application with the App Router, combining React 19 frontend with API routes for backend functionality.

### Core Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS, PrimeReact
- **Backend**: Next.js API Routes, MongoDB with Mongoose
- **AI Integration**: Baidu AI (text summarization), OpenAI API, ChromaDB/Pinecone (vector search)
- **Authentication**: NextAuth.js with Google OAuth and MongoDB adapter

### Key Architecture Patterns

**App Router Structure**: Uses Next.js App Router with `app/` directory containing pages and API routes.

**Data Models**: Mongoose models in `models/` directory handle MongoDB schemas for users, cases, chats, bookmarks, likes, and user profiles.

**Custom Hooks**: React hooks in `hooks/` directory manage state and side effects:
- `useChatState.ts` - Chat management
- `useCases.ts` - Case data fetching
- `useInfiniteScroll.ts` - Pagination
- `useAuth.ts` - Authentication state

**Component Architecture**: Reusable components in `components/` directory with separation of concerns:
- `ChatComponent.tsx` - Main chat interface with AI
- `CaseCard.tsx` - Legal case display components
- `MarkdownRenderer.tsx` - Markdown rendering with syntax highlighting

**AI Integration**: Multiple AI services integrated:
- RAG (Retrieval Augmented Generation) using ChromaDB for vector search
- Baidu AI for text summarization via `/api/summary`
- OpenAI/ZhipuAI for chat completions via `/api/fetchAi`

### API Design

REST API endpoints in `app/api/`:
- `/api/recommend` - Case recommendation system
- `/api/summary` - AI-powered text summarization
- `/api/fetchAi` - Chat completions with context
- `/api/cases/*` - Case management (like, bookmark)
- `/api/auth/[...nextauth]` - Authentication
- `/api/getChats` - Chat history retrieval

## Environment Configuration

Required environment variables (create `.env.local`):
```
MONGODB_URL=mongodb+srv://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_ID=...
GOOGLE_SECRET=...
BAIDU_AK=...
BAIDU_SK=...
AI_API_KEY=...
AI_BASE_URL=...
AI_MODEL=...
```

## Database Schema

MongoDB collections managed by Mongoose models:
- `users` - User authentication and profiles
- `records` - Legal case records
- `chats` - Chat conversations
- `likes`/`bookmarks` - User interactions
- `articles` - Additional content

## Styling

- TailwindCSS for utility-first styling
- PrimeReact component library with Saga Blue theme
- Custom CSS in `styles/markdown.css` for markdown rendering
- Responsive design patterns throughout

## Testing

Jest configuration with Next.js integration:
- Test environment: jsdom
- Module path mapping for `@/` imports
- Coverage collection for components and app files (excluding API routes)