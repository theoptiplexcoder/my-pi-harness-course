import { Database } from "bun:sqlite";

export interface WorkflowState {
  workflowId: string;
  stepIndex: number;
  done: boolean;
  context: Record<string, any>;
  lastResult?: any;
  updatedAt: number;
}

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
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  async load(workflowId: string): Promise<WorkflowState> {
    const row = this.db.query(
      "SELECT workflow_id, step_index, done, context, last_result, updated_at FROM workflow_state WHERE workflow_id = ?"
    ).get(workflowId) as any;

    if (!row) {
      return {
        workflowId,
        stepIndex: 0,
        done: false,
        context: {},
        updatedAt: Date.now(),
      };
    }

    return {
      workflowId: row.workflow_id,
      stepIndex: row.step_index,
      done: Boolean(row.done),
      context: JSON.parse(row.context),
      lastResult: row.last_result ? JSON.parse(row.last_result) : undefined,
      updatedAt: row.updated_at,
    };
  }

  async checkpoint(workflowId: string, updates: Partial<WorkflowState>): Promise<void> {
    const current = await this.load(workflowId);
    const updated: WorkflowState = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };

    this.db.run(
      `INSERT INTO workflow_state (workflow_id, step_index, done, context, last_result, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(workflow_id) DO UPDATE SET
         step_index = excluded.step_index,
         done = excluded.done,
         context = excluded.context,
         last_result = excluded.last_result,
         updated_at = excluded.updated_at`,
      [
        updated.workflowId,
        updated.stepIndex,
        updated.done ? 1 : 0,
        JSON.stringify(updated.context),
        updated.lastResult !== undefined ? JSON.stringify(updated.lastResult) : null,
        updated.updatedAt,
      ]
    );
  }

  async appendEvent(workflowId: string, eventType: string, payload: any): Promise<void> {
    this.db.run(
      "INSERT INTO event_log (workflow_id, event_type, payload, timestamp) VALUES (?, ?, ?, ?)",
      [workflowId, eventType, JSON.stringify(payload), Date.now()]
    );
  }

  async getEvents(workflowId: string): Promise<any[]> {
    const rows = this.db.query(
      "SELECT event_type, payload, timestamp FROM event_log WHERE workflow_id = ? ORDER BY id ASC"
    ).all(workflowId) as any[];

    return rows.map((r) => ({
      eventType: r.event_type,
      payload: JSON.parse(r.payload),
      timestamp: r.timestamp,
    }));
  }

  close() {
    this.db.close();
  }
}
