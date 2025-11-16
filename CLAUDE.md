# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack application with a React + Vite frontend and Node.js Express backend. Simple message board application demonstrating CRUD operations.

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite build tool
- Tailwind CSS 4
- shadcn/ui components
- Path alias: `@/` → `frontend/src/`

**Backend:**
- Node.js with Express 5
- TypeScript
- CORS enabled for development
- In-memory data store (no database)

## Development Commands

### Backend (port 3000)
```bash
cd backend
npm install
npm run dev      # Development with hot reload (tsx watch)
npm start        # Production run
```

### Frontend (port 5173)
```bash
cd frontend
npm install
npm run dev      # Development server
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Architecture

**Monorepo structure** - Frontend and backend are separate npm projects in the same repository.

**API Communication:**
- Frontend uses Vite proxy to forward `/api/*` requests to backend (configured in `vite.config.ts`)
- No environment variables needed for local development
- Backend runs on port 3000, frontend on 5173

**Data Flow:**
- Backend stores messages in-memory array (resets on restart)
- Frontend fetches messages on mount and after creating new ones
- Simple REST API with GET and POST endpoints

## API Endpoints

- `GET /api/messages` - Retrieve all messages
- `POST /api/messages` - Create message (body: `{ "text": string }`)
- `GET /api/health` - Health check

## Component Architecture

**shadcn/ui Integration:**
- Components located in `frontend/src/components/ui/`
- Uses class-variance-authority for component variants
- Tailwind CSS with custom configuration
- Components: Button, Card (with subcomponents), Input

**Styling:**
- Tailwind CSS 4 with dark mode support
- Utility-first approach with `tailwind-merge` for class merging
- Global styles in `frontend/src/index.css`

## TypeScript Configuration

**Frontend:**
- Project references pattern (tsconfig.json splits app and node configs)
- Strict mode enabled
- Path aliases configured for `@/` imports

**Backend:**
- Target: ES2022, Module: ESNext
- Bundler module resolution
- Strict mode enabled
- Output to `dist/` directory
