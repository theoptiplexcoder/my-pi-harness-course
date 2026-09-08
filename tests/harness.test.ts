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
  expect(finalState.history.length).toBe(3);
  expect(finalState.history[0].result.priority).toBe("high");
});
