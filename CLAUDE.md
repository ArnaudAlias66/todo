# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Start dev server with auto-reload (node --watch)
npm start       # Start production server
```

No build step, linter, or test suite is configured.

## Environment Setup

Copy the appropriate template to `.env` before starting:
- `.env.local.example` — local PostgreSQL on localhost
- `.env.srv.example` — shared server at 192.168.1.3

Required env vars: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PORT`, `SESSION_SECRET`.

The database tables (`users`, `tasks`) are created automatically on first run via [db.js](db.js).

## Architecture

**Backend** — [server.js](server.js) is a single-file Express app (ES modules) with:
- Session auth via `express-session` backed by PostgreSQL (`connect-pg-simple`)
- Auth routes: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Task CRUD routes with ownership/assignment-based access control (owner + assignee can edit; only owner can delete)
- [db.js](db.js) exports a pg connection pool and runs idempotent migrations on startup

**Frontend** — [public/](public/) is pure HTML/CSS/vanilla JS, served as static files:
- [app.js](public/app.js) — list view (filter, search, CRUD)
- [kanban.js](public/kanban.js) — Kanban board with drag-and-drop, opens in a separate window
- [auth.js](public/auth.js) — session guard; redirects unauthenticated users to `login.html`
- [style.css](public/style.css) — dark theme (Slate/Indigo), shared across all pages

## Key Domain Concepts

Tasks have: title, description, priority (basse/normale/haute), due date, status (À faire / En cours / Terminé), owner, and optional assignee. Overdue tasks are highlighted in the UI. The Kanban board and list view are independent pages sharing the same API.
