import { StateStore, type WorkflowState } from "./state";
import { DefaultToolPolicy, type ToolPolicy, type ToolCallStep } from "./policies";
import { DefaultMemoryHydrator, type ContextHydrator } from "./memory";
import { AgentRouter } from "./router";
import { safeTools, allTools } from "./tools";

export class AgentRuntime {
  stateStore: StateStore;
  policy: ToolPolicy;
  hydrator: ContextHydrator;
  router: AgentRouter;
  private emit: (type: string, data: any) => void;

  constructor(options?: { stateStore?: StateStore; policy?: ToolPolicy; hydrator?: ContextHydrator; router?: AgentRouter; emit?: (type: string, data: any) => void }) {
    this.stateStore = options?.stateStore || new StateStore(":memory:");
    this.policy = options?.policy || new DefaultToolPolicy();
    this.hydrator = options?.hydrator || new DefaultMemoryHydrator();
    this.router = options?.router || new AgentRouter();
    this.emit = options?.emit || (() => {});
  }

  async executeStep(step: ToolCallStep): Promise<any> {
    if (step.tool === "routeIntent") {
      const handoff = this.router.route(step.params.intent, step.params.payload);
      return await this.router.executeHandoff(handoff);
    }

    const toolDef = allTools[step.tool];
    if (!toolDef) throw new Error(`Unknown tool: ${step.tool}`);
    return await toolDef.execute(step.params);
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
      if (this.hydrator instanceof DefaultMemoryHydrator) {
        const history = state.context.history || [];
        if (history.length > 5) {
          const { kept, summary } = this.hydrator.compact(history);
          state.context.history = kept;
          state.context.summary = summary;
          await this.stateStore.checkpoint(workflowId, state);
        }
      }

      const contextPrompt = await this.hydrator.hydrate(state);
      this.emit("workflow_step", { stepIndex: state.stepIndex, contextPrompt });

      const queue = state.context.queue || [];
      if (state.stepIndex >= queue.length) {
        state.done = true;
        await this.stateStore.checkpoint(workflowId, { done: true });
        break;
      }

      const step = queue[state.stepIndex];

      const check = await this.policy.check(step);
      if (!check.allowed && !check.requiresApproval) {
        this.emit("policy_blocked", { step, reason: check.reason });
        await this.stateStore.appendEvent(workflowId, "policy_blocked", { step, reason: check.reason });
        throw new Error(`Execution policy blocked: ${check.reason}`);
      }

      await this.stateStore.appendEvent(workflowId, "tool_step_decided", step);

      this.emit("tool_call_start", { step });
      const result = await this.executeStep(step);
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
