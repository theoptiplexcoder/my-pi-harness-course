# Lesson 1: The Agent Harness & Event Spine

> Stop building fragile while-loops. Start building observable agent execution loops.

---

## The Pain

Most naive agent scripts look like this:

```ts
while (!done) {
  const step = await llm.generateNextStep(history);
  const result = await executeTool(step.tool, step.args);
  history.push({ step, result });
}
```

In production, this naive loop immediately breaks:
1. **No Observability**: When an agent runs for 40 seconds, the frontend has no idea if the agent is thinking, running a database query, or frozen.
2. **Crash Fragility**: If the process crashes mid-stream, in-flight work and streaming tokens are completely lost.
3. **No Boundaries**: The agent loop directly couples the LLM client, tool execution, and delivery transport.

---

## What the Harness Adds

The **harness** is the middleware between the raw LLM and execution:
- **The Event Bus (`server/bus.ts`)**: Emits structured lifecycle events (`workflow_start`, `workflow_step`, `tool_call_start`, `tool_call_end`, `workflow_end`).
- **Typed Tool Registry (`harness/tools.ts`)**: Distinguishes between **Safe Tools** (auto-run with zero approval) and **Dangerous Tools** (require verification).
- **The Execution Spine (`harness/runtime.ts`)**: A standardized loop where the LLM decides semantic steps, but the harness governs execution.

---

## The Core Code

### Safe vs Dangerous Tools (`harness/tools.ts`)
```ts
export const safeTools = {
  searchKnowledgeBase: { ... },
  summarizeDocument: { ... },
  classifyItem: { ... },
  createDraft: { ... }
};
```

### The Standardized Loop (`harness/runtime.ts`)
```ts
export class AgentRuntime {
  async runWorkflow(workflowId: string, input?: any): Promise<WorkflowState> {
    let state = await this.stateStore.load(workflowId);
    this.emit("workflow_start", { workflowId, state });

    while (!state.done) {
      const step = await this.decideNextStep(state);
      if (!step) break;

      this.emit("tool_call_start", { step });
      const result = await this.executeStep(step);
      this.emit("tool_call_end", { step, result });

      state.stepIndex += 1;
      await this.stateStore.checkpoint(workflowId, state);
    }

    this.emit("workflow_end", { workflowId, state });
    return state;
  }
}
```

---

## In Production

In production systems, tools like **Temporal Activities** or **Inngest Steps** wrap each step so that events stream over WebSockets/SSE to your dashboard, giving full visibility into LLM thought-action cycles.
