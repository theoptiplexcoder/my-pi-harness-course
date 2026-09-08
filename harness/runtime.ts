import { StateStore, type WorkflowState } from "./state";
import { safeTools, allTools } from "./tools";

export class AgentRuntime {
  stateStore: StateStore;
  private emit: (type: string, data: any) => void;

  constructor(options?: { stateStore?: StateStore; emit?: (type: string, data: any) => void }) {
    this.stateStore = options?.stateStore || new StateStore(":memory:");
    this.emit = options?.emit || (() => {});
  }

  async runWorkflow(workflowId: string, input?: any): Promise<WorkflowState> {
    let state = await this.stateStore.load(workflowId);

    if (input && state.stepIndex === 0 && !state.context.queue) {
      state.context = {
        ...state.context,
        queue: input.steps || [],
        history: [],
      };
      await this.stateStore.checkpoint(workflowId, state);
    }

    this.emit("workflow_start", { workflowId, state });

    while (!state.done) {
      const queue = state.context.queue || [];
      if (state.stepIndex >= queue.length) {
        state.done = true;
        await this.stateStore.checkpoint(workflowId, { done: true });
        break;
      }

      const step = queue[state.stepIndex];
      this.emit("workflow_step", { stepIndex: state.stepIndex, step });

      await this.stateStore.appendEvent(workflowId, "tool_step_decided", step);

      this.emit("tool_call_start", { step });
      const toolDef = allTools[step.tool];
      if (!toolDef) throw new Error(`Unknown tool: ${step.tool}`);
      const result = await toolDef.execute(step.params);
      this.emit("tool_call_end", { step, result });

      const history = state.context.history || [];
      history.push({ step: state.stepIndex, tool: step.tool, result });

      state.stepIndex += 1;
      state.lastResult = result;
      state.context.history = history;

      if (state.stepIndex >= queue.length) {
        state.done = true;
      }

      await this.stateStore.checkpoint(workflowId, state);
      this.emit("checkpoint_saved", { workflowId, stepIndex: state.stepIndex });
    }

    this.emit("workflow_end", { workflowId, state });
    return state;
  }
}
