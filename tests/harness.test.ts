import { test, expect } from "bun:test";
import { AgentRuntime } from "../harness/runtime";
import { StateStore } from "../harness/state";
import { DefaultToolPolicy } from "../harness/policies";
import { DefaultMemoryHydrator } from "../harness/memory";
import { AgentRouter } from "../harness/router";
import { HierarchicalSupervisor } from "../harness/supervisor";
import { ApprovalStore } from "../harness/approvals";

test("Lesson 1: Agent Runtime and Safe Tools execute cleanly", async () => {
  const runtime = new AgentRuntime();
  const input = {
    steps: [
      { tool: "classifyItem", params: { item: "Urgent server crash report" } },
      { tool: "searchKnowledgeBase", params: { query: "refund_policy" } },
      { tool: "createDraft", params: { title: "Draft Response", body: "Issue reviewed." } },
    ],
  };

  const finalState = await runtime.runWorkflow("wf-lesson-1", input);
  expect(finalState.done).toBe(true);
  expect(finalState.stepIndex).toBe(3);
  expect(finalState.context.history.length).toBe(3);
  expect(finalState.context.history[0].result.priority).toBe("high");
});

test("Lesson 2: Durable StateStore checkpoints and survives interruption", async () => {
  const store = new StateStore(":memory:");
  await store.checkpoint("wf-durable", { stepIndex: 1, done: false, context: { counter: 42 } });

  const loaded = await store.load("wf-durable");
  expect(loaded.stepIndex).toBe(1);
  expect(loaded.context.counter).toBe(42);

  await store.appendEvent("wf-durable", "test_event", { msg: "checkpointed" });
  const events = await store.getEvents("wf-durable");
  expect(events.length).toBe(1);
  expect(events[0].eventType).toBe("test_event");
});

test("Lesson 3: ToolPolicy blocks dangerous injection/commands", async () => {
  const policy = new DefaultToolPolicy();
  const blockedCheck = await policy.check({
    tool: "runCode",
    params: { code: "rm -rf /" },
  });

  expect(blockedCheck.allowed).toBe(false);
  expect(blockedCheck.requiresApproval).toBe(false);
  expect(blockedCheck.reason).toContain("blocked by ToolPolicy");

  const safeCheck = await policy.check({
    tool: "classifyItem",
    params: { item: "safe task" },
  });
  expect(safeCheck.allowed).toBe(true);
});

test("Lesson 4: Memory Hydrator & Compaction shrinks history window", async () => {
  const hydrator = new DefaultMemoryHydrator(2);
  const history = [
    { tool: "step1" },
    { tool: "step2" },
    { tool: "step3" },
    { tool: "step4" },
  ];

  const { kept, summary } = hydrator.compact(history);
  expect(kept.length).toBe(2);
  expect(summary).toContain("Compacted 2 older steps");
});

test("Lesson 5: Router dispatches intent to specialists", async () => {
  const router = new AgentRouter();
  router.register({
    name: "supportSpecialist",
    description: "Handles customer queries",
    handle: async (packet) => ({ resolvedBy: "support", query: packet.query }),
  });

  const handoff = router.route("Need help with customer ticket", { query: "Can I get a refund?" });
  expect(handoff.targetAgent).toBe("supportSpecialist");

  const res = await router.executeHandoff(handoff);
  expect(res.resolvedBy).toBe("support");
});

test("Lesson 6: Hierarchical Supervisor plans, runs in parallel, and synthesizes", async () => {
  const supervisor = new HierarchicalSupervisor();
  supervisor.registerWorker("textWorker", async (payload) => `Analyzed text: ${payload.text}`);
  supervisor.registerWorker("codeWorker", async (payload) => `Executed snippet: ${payload.code}`);

  const packet = {
    items: [
      { type: "text", text: "Report A" },
      { type: "code", code: "console.log('hi')" },
      { type: "text", text: "Report B" },
    ],
  };

  const plan = supervisor.plan(packet);
  expect(plan.length).toBe(3);

  const results = await supervisor.executeParallel(plan);
  const synthesis = supervisor.synthesize(results);
  expect(synthesis.total).toBe(3);
  expect(synthesis.succeeded).toBe(3);
  expect(synthesis.failed).toBe(0);
});

test("Lesson 7: Human-in-the-Loop suspends and resumes upon approval", async () => {
  const approvalStore = new ApprovalStore(":memory:");
  const runtime = new AgentRuntime({ approvalStore });

  const input = {
    steps: [
      { tool: "classifyItem", params: { item: "Billing dispute" } },
      { tool: "sendMessage", params: { recipient: "client@example.com", message: "Refund issued" } },
    ],
  };

  // Step 1 executes safe tool, step 2 requires approval and suspends
  const stateSuspended = await runtime.runWorkflow("wf-approval-test", input);
  expect(stateSuspended.done).toBe(false);
  expect(stateSuspended.stepIndex).toBe(1);

  const pending = await approvalStore.getPending("wf-approval-test");
  expect(pending.length).toBe(1);
  expect(pending[0]!.tool).toBe("sendMessage");

  // Resume workflow with human approval
  const finalState = await runtime.resumeWorkflow("wf-approval-test", pending[0]!.id, true);
  expect(finalState.done).toBe(true);
  expect(finalState.stepIndex).toBe(2);
  expect(finalState.context.history[1]!.approved).toBe(true);
});

test("Lesson 5 & 6 Integration: Runtime executes router and supervisor steps directly", async () => {
  const router = new AgentRouter();
  router.register({
    name: "securitySpecialist",
    description: "Security analysis",
    handle: async (packet) => ({ status: "scanned", issues: 0 }),
  });

  const supervisor = new HierarchicalSupervisor();
  supervisor.registerWorker("textWorker", async (item) => `Processed: ${item.text}`);

  const runtime = new AgentRuntime({ router, supervisor });

  const input = {
    steps: [
      {
        tool: "routeIntent",
        params: { intent: "Check code security and vulnerabilities", payload: { target: "auth.ts" } },
      },
      {
        tool: "superviseParallel",
        params: {
          items: [
            { type: "text", text: "Part 1" },
            { type: "text", text: "Part 2" },
          ],
        },
      },
    ],
  };

  const state = await runtime.runWorkflow("wf-router-super-test", input);
  expect(state.done).toBe(true);
  expect(state.stepIndex).toBe(2);
  expect(state.context.history[0]!.result.status).toBe("scanned");
  expect(state.context.history[1]!.result.total).toBe(2);
  expect(state.context.history[1]!.result.succeeded).toBe(2);
});
