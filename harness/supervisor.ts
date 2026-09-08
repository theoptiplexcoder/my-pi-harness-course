export interface SubTask {
  id: string;
  agent: string;
  payload: any;
}

export interface SubTaskResult {
  id: string;
  agent: string;
  status: "completed" | "failed";
  result?: any;
  error?: string;
}

export class HierarchicalSupervisor {
  private workers: Map<string, (payload: any) => Promise<any>> = new Map();

  registerWorker(name: string, handler: (payload: any) => Promise<any>) {
    this.workers.set(name, handler);
  }

  // Decompose task packet into parallel subtasks
  plan(taskPacket: { items: any[] }): SubTask[] {
    return taskPacket.items.map((item, idx) => ({
      id: `subtask-${idx + 1}`,
      agent: item.type === "code" ? "codeWorker" : "textWorker",
      payload: item
    }));
  }

  // Fan-out execution
  async executeParallel(tasks: SubTask[]): Promise<SubTaskResult[]> {
    const promises = tasks.map(async (task): Promise<SubTaskResult> => {
      const worker = this.workers.get(task.agent);
      if (!worker) {
        return {
          id: task.id,
          agent: task.agent,
          status: "failed",
          error: `No worker registered for agent type: ${task.agent}`
        };
      }

      try {
        const result = await worker(task.payload);
        return {
          id: task.id,
          agent: task.agent,
          status: "completed",
          result
        };
      } catch (err: any) {
        return {
          id: task.id,
          agent: task.agent,
          status: "failed",
          error: err.message
        };
      }
    });

    return Promise.all(promises);
  }

  // Fan-in synthesis
  synthesize(results: SubTaskResult[]): { total: number; succeeded: number; failed: number; summary: any[] } {
    return {
      total: results.length,
      succeeded: results.filter(r => r.status === "completed").length,
      failed: results.filter(r => r.status === "failed").length,
      summary: results.map(r => ({ id: r.id, status: r.status, output: r.result || r.error }))
    };
  }
}
