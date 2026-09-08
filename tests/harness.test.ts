import { test, expect } from "bun:test";
import { AgentRuntime } from "../harness/runtime";

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

import { StateStore } from "../harness/state";

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

import { DefaultToolPolicy } from "../harness/policies";

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
