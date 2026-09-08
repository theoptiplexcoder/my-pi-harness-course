# Harness Engineering & Agent Orchestration

> Stop building scripts. Start building durable multi-agent systems.

This is a companion repo for the [Master.dev Harness Engineering course](https://master.dev/courses/agent-harness/) covering the infrastructure layer around an LLM — the **harness** — that makes agents survive production. Move past basic while-loops and API wrappers and learn the
patterns that keep agents durable, isolated, memory-aware, and coordinated.

Instead of one large cumulative project, each lesson tackles a **new architectural pattern**: you
see it introduced, watch it live-coded in TypeScript/Bun, and move on.

## What you'll learn

1. **The Agent Harness** — the middleware that gives an LLM its context, tools, and guardrails.
2. **Durable Execution** — checkpoint agent steps so a crash or rate limit resumes exactly where it left off.
3. **Secure Sandboxing** — run untrusted, agent-generated code in an isolated runtime with timeouts.
4. **Advanced Memory** — hydrate the right context with state stores, sliding windows, and summarization.
5. **Orchestration** — route intent and hand off context between a triage agent and specialists.
6. **Hierarchical Supervision** — a supervisor that plans, spawns parallel sub-agents, and merges results.
7. **Human-in-the-Loop** — durable suspend/resume to wait minutes or days for human approval.

## How the course is organized

Each lesson is its own git branch:

```
lesson-1 → lesson-2 → ... → lesson-7 (latest)
```

Each lesson branch contains:

- The solution for the **previous** lesson (so you can catch up if you fall behind).
- The notes for the **current** lesson under `lessons/<lesson-name>/index.md`.

Two convenience branches:

- **`main`** — points at the latest lesson. This is what you see on the GitHub landing page.
- **`complete`** — same as `main`, an explicit name for "everything that exists right now."

So if you fall behind in lesson 4, `git checkout lesson-5` to grab the lesson 4 solution and pick
up from there.

### Reading the lesson notes

Notes live alongside the code under `lessons/`. You can read them three ways:

- **On GitHub or in your editor** — they're plain markdown.
- **In Obsidian** — open the `lessons/` directory as a vault.
- **As a local site** — run `npm run docs` to serve them with VitePress at http://localhost:5173.

## Setup

### 1. Clone and install

```bash
git clone git@github.com:Hendrixer/harness-engineering.git
cd harness-engineering
bun install
```

### 2. Configure environment variables

Copy `.dev.vars.example` to `.dev.vars` (or `.env`) and fill in your keys. Bun automatically loads environment files.
Lesson 2 adds SQLite persistence (`bun:sqlite`) out of the box with zero external database setup required.

```
# Optional model overrides or API keys if connecting to live providers
ANTHROPIC_API_KEY=...
```

### 3. Run things

```bash
bun run dev         # start the harness server (:8787) via Bun.serve()
bun test            # run test suite across all lessons
bun run typecheck   # bunx tsc --noEmit across modules
bun run docs        # serve the lesson notes with VitePress
```

`bun run dev` boots the **Harness Server & Inspector Gateway** on `:8787`.
Out of the box the harness emits structured lifecycle events over a unified WebSocket connection.
In Lesson 1, you build the foundation of this harness loop.

## Prerequisites

- Comfortable with TypeScript.
- Basic understanding of LLM APIs and standard agent loops (receive → think → act → respond).
- Familiarity with asynchronous programming and event-driven architecture.

## Tech stack

- **Runtime:** Bun + TypeScript (run with `bun <file>`, no build step for the server).
- **Server:** `Bun.serve()` — native HTTP and WebSocket server hosting the harness event stream over one WebSocket.
- **LLM / Agent SDK:** `@earendil-works/pi-coding-agent` (typed tools, session manager, model runtime).
- **Database / State:** `bun:sqlite` (introduced in Lesson 2 for durable execution & checkpointing).
- **Notes:** VitePress (`bun run docs`).

Everything runs locally with Bun. No external database or heavy setup needed.
