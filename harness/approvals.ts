import { Database } from "bun:sqlite";

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  stepIndex: number;
  tool: string;
  params: Record<string, any>;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  decidedAt?: number;
}

export class ApprovalStore {
  private db: Database;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        tool TEXT NOT NULL,
        params TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        decided_at INTEGER
      );
    `);
  }

  async createRequest(req: Omit<ApprovalRequest, "status" | "createdAt">): Promise<ApprovalRequest> {
    const fullReq: ApprovalRequest = {
      ...req,
      status: "pending",
      createdAt: Date.now()
    };

    this.db.run(
      `INSERT INTO approvals (id, workflow_id, step_index, tool, params, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fullReq.id,
        fullReq.workflowId,
        fullReq.stepIndex,
        fullReq.tool,
        JSON.stringify(fullReq.params),
        fullReq.status,
        fullReq.createdAt
      ]
    );

    return fullReq;
  }

  async resolve(id: string, decision: "approved" | "rejected"): Promise<ApprovalRequest | null> {
    const decidedAt = Date.now();
    this.db.run(
      `UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?`,
      [decision, decidedAt, id]
    );

    return this.get(id);
  }

  async get(id: string): Promise<ApprovalRequest | null> {
    const row = this.db.query(
      "SELECT id, workflow_id, step_index, tool, params, status, created_at, decided_at FROM approvals WHERE id = ?"
    ).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      workflowId: row.workflow_id,
      stepIndex: row.step_index,
      tool: row.tool,
      params: JSON.parse(row.params),
      status: row.status,
      createdAt: row.created_at,
      decidedAt: row.decided_at || undefined
    };
  }

  async getPending(workflowId: string): Promise<ApprovalRequest[]> {
    const rows = this.db.query(
      "SELECT id, workflow_id, step_index, tool, params, status, created_at, decided_at FROM approvals WHERE workflow_id = ? AND status = 'pending'"
    ).all(workflowId) as any[];

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      stepIndex: row.step_index,
      tool: row.tool,
      params: JSON.parse(row.params),
      status: row.status,
      createdAt: row.created_at,
      decidedAt: row.decided_at || undefined
    }));
  }

  close() {
    this.db.close();
  }
}
