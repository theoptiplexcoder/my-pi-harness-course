# Getting Started & Learning Guide: Pi Harness Engineering

Welcome to the **Harness Engineering & Agent Orchestration** codebase!

This guide shows you how to navigate, run, experiment with, and learn the architectural concepts behind production-grade agent runtimes using **Bun**, **TypeScript**, and the **Pi Coding Agent SDK (`@earendil-works/pi-coding-agent`)**.

---

## 1. Quick Start

### Prerequisites
- [Bun](https://bun.sh) (v1.2+) installed on your system.

### Install Dependencies
```bash
bun install
```

### Run the Test Suite
The fastest way to verify every lesson and architectural module:
```bash
bun test
```
*Output: Runs 9 comprehensive test suites covering Lessons 1 through 8.*

### Run Type Checking
Verify all TypeScript interfaces and types across the harness:
```bash
bun run typecheck
```

### Start the Gateway Server
Start the Bun-native HTTP and WebSocket harness server on port `:8787`:
```bash
bun run dev
```

---

## 2. Recommended Learning Path

Follow the course progressively. Each lesson adds one specific capability to the **execution spine**:

```
Lesson 1 ──► Lesson 2 ──► Lesson 3 ──► Lesson 4 ──► Lesson 5 ──► Lesson 6 ──► Lesson 7 ──► Lesson 8
 (Core Loop)  (Durable)   (Sandboxing) (Memory)     (Router)    (Supervisor) (Approval)  (Pi Extensibility)
```

### Step 1: Read the Blueprint
- Open [`LESSON_PLAN.md`](./LESSON_PLAN.md) to understand the high-level roadmap and see which production failure each lesson solves.
- Familiarize yourself with the core mantra:
  > **"Agent systems are workflow systems: the LLM decides the semantic step; the harness owns execution."**

### Step 2: Understand "The Spine" (`harness/runtime.ts`)
Inspect `harness/runtime.ts`. Note how each iteration of the loop handles:
1. **Context Hydration (`harness/memory.ts`)**: Injects recent memory and compressed summaries.
2. **Next Step Planning (`decideNextStep`)**: Decides the next semantic action.
3. **Policy & Sandboxing (`harness/policies.ts`)**: Evaluates safety gates before executing.
4. **Durable Logging (`harness/state.ts`)**: Persists events to `bun:sqlite` before side effects.
5. **Execution (`executeStep` / `harness/tools.ts`)**: Runs safe/dangerous tools, routes, or supervisor fanouts.
6. **State Checkpointing (`harness/state.ts`)**: Saves progress so crashes can resume seamlessly.

### Step 3: Study Lesson by Lesson

| Lesson | Focus | Key Files | What to Experiment With |
|---|---|---|---|
| **Lesson 1** | **The Event Spine** | `harness/runtime.ts`, `harness/tools.ts`, `server/bus.ts` | Add a new safe tool to `safeTools` and call it via `runtime.runWorkflow`. |
| **Lesson 2** | **Durable Execution** | `harness/state.ts` | Inspect SQLite tables (`workflow_state`, `event_log`). Test process death and resumption. |
| **Lesson 3** | **Security & Sandboxing** | `harness/policies.ts` | Add new regex patterns or path limits to `DefaultToolPolicy` to block unauthorized commands. |
| **Lesson 4** | **Memory & Compaction** | `harness/memory.ts` | Lower the `windowSize` threshold and observe older messages compacting into summaries. |
| **Lesson 5** | **Intent Routing & Handoffs** | `harness/router.ts` | Register a new domain specialist (e.g. `billingSpecialist`) and route intent packets. |
| **Lesson 6** | **Hierarchical Supervision** | `harness/supervisor.ts` | Add a new worker type and test parallel fan-out (`executeParallel`) and fan-in synthesis. |
| **Lesson 7** | **Human-in-the-Loop** | `harness/approvals.ts`, `server/index.ts` | Trigger a dangerous tool (`sendMessage`), observe suspension, and resume via approval ID. |
| **Lesson 8** | **Extending the Pi Harness** | `lessons/08-extending-pi-harness/index.md`, `harness/extensions.ts` | Build custom tools using `Type` from `typebox`, create `.pi/skills/`, and spawn subagents. |

---

## 3. How to Interact with the Running Server

The server speaks over native WebSockets (`ws://localhost:8787`):

### 1. Submit a Workflow Task
Send a JSON payload:
```json
{
  "action": "submit_task",
  "workflowId": "wf-demo-101",
  "input": {
    "steps": [
      { "tool": "classifyItem", "params": { "item": "Urgent server crash report" } },
      { "tool": "searchKnowledgeBase", "params": { "query": "refund_policy" } },
      { "tool": "sendMessage", "params": { "recipient": "ops@example.com", "message": "Server rebooting" } }
    ]
  }
}
```

### 2. Observe Workflow Suspension (Human-in-the-Loop)
Because `sendMessage` is a dangerous tool, the server emits an event:
```json
{
  "type": "approval_required",
  "workflowId": "wf-demo-101",
  "data": {
    "approval": {
      "id": "appr-...",
      "tool": "sendMessage",
      "status": "pending"
    }
  }
}
```

### 3. Approve and Resume the Workflow
Send the approval back over the WebSocket:
```json
{
  "action": "approve",
  "workflowId": "wf-demo-101",
  "approvalId": "appr-..."
}
```
The workflow resumes from the checkpoint and completes execution.

---

## 4. Extending the Codebase with Pi SDK Features

When you want to build custom extensions or skills:
1. **Create an Extension Factory**: Review `harness/extensions.ts` to see how `pi.registerTool`, `pi.registerCommand`, and `pi.on("tool_call")` are wired.
2. **Add an Agent Skill**: Create a directory under `.pi/skills/<skill-name>/` with a `SKILL.md` file following the Agent Skills specification (`allowed-tools: read bash`).
3. **Spawn Specialized Subagents**: Use `createAgentSession` with scoped tools (e.g. read-only scout subagents) to parallelize reconnaissance without bloating your primary LLM context.
