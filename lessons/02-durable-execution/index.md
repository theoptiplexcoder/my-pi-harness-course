# Lesson 2: Durable Execution & Checkpoints

> Survive server crashes, deployment restarts, and LLM rate limits without repeating work.

---

## The Pain

Imagine your agent runs a 5-step workflow:
1. `searchKnowledgeBase`
2. `summarizeDocument`
3. `chargeCreditCard` ($500)
4. `generateInvoicePdf` (Takes 15s)
5. `sendEmailNotification`

At Step 4, your server runs out of memory, or the LLM hits a 429 rate limit. If your state is in Node memory:
- The entire process restarts.
- The task is retried from Step 1.
- **The user's credit card is charged a second time!**

---

## What the Harness Adds

Durable execution guarantees **exactly-once execution semantics** around side effects:
- **`StateStore` (`harness/state.ts`)**: Persists current `stepIndex`, context, and `lastResult` into SQLite (`bun:sqlite`).
- **`EventLog`**: An append-only audit ledger of every step decided and tool executed.
- **Atomic Checkpointing**: On restart, `stateStore.load(workflowId)` resumes from the exact checkpoint without re-running completed steps.

---

## The Core Code (`harness/state.ts`)

```ts
import { Database } from "bun:sqlite";

export class StateStore {
  private db: Database;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS workflow_state (
        workflow_id TEXT PRIMARY KEY,
        step_index INTEGER NOT NULL,
        done INTEGER NOT NULL,
        context TEXT NOT NULL,
        last_result TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  async checkpoint(workflowId: string, updates: Partial<WorkflowState>): Promise<void> { ... }
  async load(workflowId: string): Promise<WorkflowState> { ... }
}
```

---

## In Production

In enterprise architectures, this matches **Temporal Workflows**, **DBOS**, or **AWS Step Functions**, where execution progress is checkpointed before external interactions take place.
