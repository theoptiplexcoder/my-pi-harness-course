# Lesson 6: Hierarchical Supervision & Parallel Fan-out

> Stop running independent tasks sequentially. Plan, fan-out concurrently, and synthesize.

---

## The Pain

When given a batch packet of 10 items (e.g. 5 log files to audit and 5 code snippets to review), sequential agent execution takes:
`10 items × 8 seconds = 80 seconds`

Worse, if item 7 fails, the sequential pipeline is blocked.

---

## What the Harness Adds

A supervisor architecture (`harness/supervisor.ts`):
- **Planner**: Breaks a composite task packet into isolated `SubTask` descriptors.
- **Fan-out Execution (`executeParallel`)**: Dispatches subtasks concurrently across worker pools.
- **Fault-Tolerant Collection**: Captures successes and failures independently without halting the entire job.
- **Fan-in Synthesis**: Aggregates worker outputs into a single structured executive summary.

---

## The Core Code (`harness/supervisor.ts`)

```ts
export class HierarchicalSupervisor {
  plan(taskPacket: { items: any[] }): SubTask[] {
    return taskPacket.items.map((item, idx) => ({
      id: `subtask-${idx + 1}`,
      agent: item.type === "code" ? "codeWorker" : "textWorker",
      payload: item
    }));
  }

  async executeParallel(tasks: SubTask[]): Promise<SubTaskResult[]> {
    return Promise.all(tasks.map(async (task) => {
      const worker = this.workers.get(task.agent);
      try {
        const result = await worker(task.payload);
        return { id: task.id, agent: task.agent, status: "completed", result };
      } catch (err: any) {
        return { id: task.id, agent: task.agent, status: "failed", error: err.message };
      }
    }));
  }

  synthesize(results: SubTaskResult[]) {
    return {
      total: results.length,
      succeeded: results.filter(r => r.status === "completed").length,
      failed: results.filter(r => r.status === "failed").length,
      summary: results.map(r => ({ id: r.id, status: r.status, output: r.result || r.error }))
    };
  }
}
```

---

## In Production

Corresponds to **Supervisor / Worker Trees** in LangGraph or hierarchical orchestrations in Temporal.
