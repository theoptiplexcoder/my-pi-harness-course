import { StateStore, type WorkflowState } from "./state";
import { DefaultToolPolicy, type ToolPolicy, type ToolCallStep } from "./policies";
import { DefaultMemoryHydrator, type ContextHydrator } from "./memory";
import { ApprovalStore } from "./approvals";
import { AgentRouter } from "./router";
import { HierarchicalSupervisor } from "./supervisor";
import { safeTools, dangerousTools, allTools } from "./tools";

export interface WorkflowOptions {
  stateStore?: StateStore;
  policy?: ToolPolicy;
  hydrator?: ContextHydrator;
  approvalStore?: ApprovalStore;
  router?: AgentRouter;
  supervisor?: HierarchicalSupervisor;
  emit?: (type: string, data: any) => void;
}

export class AgentRuntime {
  stateStore: StateStore;
  policy: ToolPolicy;
  hydrator: ContextHydrator;
  approvalStore: ApprovalStore;
  router: AgentRouter;
  supervisor: HierarchicalSupervisor;
  private emit: (type: string, data: any) => void;

  constructor(options?: WorkflowOptions) {
    this.stateStore = options?.stateStore || new StateStore(":memory:");
    this.policy = options?.policy || new DefaultToolPolicy();
    this.hydrator = options?.hydrator || new DefaultMemoryHydrator();
    this.approvalStore = options?.approvalStore || new ApprovalStore(":memory:");
    this.router = options?.router || new AgentRouter();
    this.supervisor = options?.supervisor || new HierarchicalSupervisor();
    this.emit = options?.emit || (() => {});
  }

  async executeStep(step: ToolCallStep): Promise<any> {
    if (step.tool === "routeIntent") {
      const handoff = this.router.route(step.params.intent, step.params.payload);
      return await this.router.executeHandoff(handoff);
    }

    if (step.tool === "superviseParallel") {
      const plan = this.supervisor.plan({ items: step.params?.items || [] });
      const results = await this.supervisor.executeParallel(plan);
      return this.supervisor.synthesize(results);
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
      if (!check.allowed) {
        if (check.requiresApproval) {
          const approval = await this.approvalStore.createRequest({
            id: `appr-${Date.now()}-${state.stepIndex}`,
            workflowId,
            stepIndex: state.stepIndex,
            tool: step.tool,
            params: step.params,
          });

          this.emit("approval_required", { approval, step });
          await this.stateStore.appendEvent(workflowId, "approval_required", approval);
          return state; // workflow suspends!
        } else {
          this.emit("policy_blocked", { step, reason: check.reason });
          await this.stateStore.appendEvent(workflowId, "policy_blocked", { step, reason: check.reason });
          throw new Error(`Execution policy blocked: ${check.reason}`);
        }
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

  async resumeWorkflow(workflowId: string, approvalId: string, approved: boolean): Promise<WorkflowState> {
    const approval = await this.approvalStore.resolve(approvalId, approved ? "approved" : "rejected");
    if (!approval) throw new Error(`Approval request ${approvalId} not found`);

    this.emit("approval_resolved", { approvalId, approved });
    await this.stateStore.appendEvent(workflowId, "approval_resolved", { approvalId, approved });

    let state = await this.stateStore.load(workflowId);

    if (approved) {
      const toolDef = allTools[approval.tool];
      if (!toolDef) throw new Error(`Unknown approved tool: ${approval.tool}`);
      const result = await toolDef.execute(approval.params);

      const history = state.context.history || [];
      history.push({ step: state.stepIndex, tool: approval.tool, result, approved: true });

      state.stepIndex += 1;
      state.lastResult = result;
      state.context.history = history;

      const queue = state.context.queue || [];
      if (state.stepIndex >= queue.length) {
        state.done = true;
      }

      await this.stateStore.checkpoint(workflowId, state);
      return this.runWorkflow(workflowId);
    } else {
      state.stepIndex += 1;
      const queue = state.context.queue || [];
      if (state.stepIndex >= queue.length) {
        state.done = true;
      }
      await this.stateStore.checkpoint(workflowId, state);
      return this.runWorkflow(workflowId);
    }
  }
}
