import { safeTools, allTools } from "./tools";

export class AgentRuntime {
  private emit: (type: string, data: any) => void;

  constructor(options?: { emit?: (type: string, data: any) => void }) {
    this.emit = options?.emit || (() => {});
  }

  async runWorkflow(workflowId: string, input?: any): Promise<any> {
    const queue = input?.steps || [];
    const history: any[] = [];
    this.emit("workflow_start", { workflowId, queue });

    for (let stepIndex = 0; stepIndex < queue.length; stepIndex++) {
      const step = queue[stepIndex];
      this.emit("workflow_step", { stepIndex, step });

      this.emit("tool_call_start", { step });
      const toolDef = allTools[step.tool];
      if (!toolDef) throw new Error(`Unknown tool: ${step.tool}`);
      const result = await toolDef.execute(step.params);
      this.emit("tool_call_end", { step, result });

      history.push({ step: stepIndex, tool: step.tool, result });
    }

    const state = { workflowId, stepIndex: queue.length, done: true, history };
    this.emit("workflow_end", { workflowId, state });
    return state;
  }
}
