# Lesson Plan: Mastering the Pi Harness & Agent Orchestration

Welcome to the **Harness Engineering & Agent Orchestration** workshop course using **Bun**, **TypeScript**, and the **Pi Coding Agent SDK (`@earendil-works/pi-coding-agent`)**.

---

## Core Philosophy: "The Harness is the Protagonist"

Standard agent scripts are fragile while-loops:
```ts
// Naive agent loop: fragile, non-durable, unmonitored
while (!done) {
  const response = await llm.call(history);
  executeTool(response.tool);
}
```

In production, **agent systems are workflow systems**. The LLM decides the next semantic step; the harness owns execution, isolation, durability, memory hydrations, policy enforcement, and coordination.

Our execution loop ("The Spine"):
```ts
async function runWorkflow(workflowId: string, input: any) {
  const state = await stateStore.load(workflowId);
  while (!state.done) {
    const context = await hydrateContext(state);     // L4: Memory & Compaction
    const step    = await agent.next(context);       // LLM decision
    await policy.check(step);                         // L3: Sandboxing & L7: Approval
    await eventLog.append(workflowId, step);          // L2: Durable Event Log
    const result  = await executeStep(step);          // Safe/Dangerous Tool execution
    await stateStore.checkpoint(workflowId, result);  // L2: Durable Checkpoint
  }
}
```

---

## 7-Lesson Architectural Roadmap

| Lesson | Module & Concept | Production Failure Addressed | Pi SDK / Harness Implementation |
|---|---|---|---|
| **Lesson 1** | **The Agent Harness & Event Spine** | Script crashes lose stream state, no observability, raw unconstrained loops. | `createAgentSession`, `SessionManager.inMemory()`, typed tool registration (`safeTools`), WebSocket/EventBus lifecycle stream (`AgentEvent`). |
| **Lesson 2** | **Durable Execution & Checkpoints** | Mid-stream server crash or rate-limit wipes history and re-runs expensive/side-effecting tools. | `bun:sqlite` backed `StateStore` + `EventLog`, Pi `SessionManager` entry tree restoration, resume from checkpoint. |
| **Lesson 3** | **Secure Sandboxing & Tool Policies** | LLM hallucinates destructive shell commands or writes to sensitive files (`.env`). | `ToolPolicy` pipeline (`beforeToolCall` hook), policy gates, sandbox isolation for code execution. |
| **Lesson 4** | **Advanced Memory & Compaction** | Context window overflows and token degradation over long multi-turn sessions. | Pi context compaction algorithm (`keepRecentTokens`, `CompactionEntry`), branch summarization, memory hydration. |
| **Lesson 5** | **Orchestration & Handoffs** | Monolithic prompt degrades with complex multi-domain task packets. | Triage Router, typed `Handoff` mechanisms, specialized Pi sub-agent contexts. |
| **Lesson 6** | **Hierarchical Supervision** | Bottlenecked sequential steps when tasks can be planned and executed concurrently. | Supervisor agent, fan-out parallel sub-agent dispatch, structured output aggregation and synthesis. |
| **Lesson 7** | **Human-in-the-Loop & Suspended Workflows** | High-stakes actions (payments, ticketing, deployment) executed without human sign-off. | Suspend/resume execution state, `ApprovalStore`, WebSocket approval modal handshake. |
| **Lesson 8** | **Extending the Pi Harness (Tools, Agents, Skills)** | Monolithic capabilities lacking custom domain tools, sandboxed subagents, or progressive skill loading. | Pi `DefaultResourceLoader`, `ExtensionAPI` (`registerTool`, `registerCommand`, `on("tool_call")`), custom skills specification (`SKILL.md`), programmatic subagent spawning (`createAgentSession`). |

---

## The Reused Scenario: Domain-Neutral Task Packet

To keep focus strictly on the harness infrastructure, we reuse one domain-neutral task packet:
- **Safe Tools (Auto-run):** `searchKnowledgeBase`, `summarizeDocument`, `classifyItem`, `createDraft`
- **Dangerous Tools (Guarded / Approvals):** `runCode`, `sendMessage`, `updateRecord`, `createTicket`

---

## Architecture & Technology Conventions

- **Runtime:** Bun (`bun <file>`, `bun test`, `bun run`)
- **Server:** `Bun.serve()` with native WebSocket and HTTP routing (no Express, no ws package)
- **Database:** `bun:sqlite`
- **Pi Harness SDK:** `@earendil-works/pi-coding-agent` (`createAgentSession`, `ModelRuntime`, `SessionManager`, `TypeBox`)
- **Testing:** `bun test` for unit and integration verification of each lesson.
