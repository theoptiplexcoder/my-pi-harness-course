import { test, expect } from "bun:test";
import { createCustomResourceLoader, createAuditToolExtension } from "../harness/extensions";

test("Lesson 8: Custom ResourceLoader and Extensions load correctly", async () => {
  const loader = await createCustomResourceLoader();
  expect(loader).toBeDefined();

  // Test extension factory tool hook behavior
  const fakeHooks: Record<string, Function[]> = {};
  const mockPi: any = {
    on: (eventName: string, handler: Function) => {
      fakeHooks[eventName] = fakeHooks[eventName] || [];
      fakeHooks[eventName].push(handler);
    },
    registerCommand: (name: string, def: any) => {},
    registerTool: (def: any) => {},
  };

  const extension = createAuditToolExtension();
  extension(mockPi);

  expect(fakeHooks["tool_call"]).toBeDefined();
  const toolCallHooks = fakeHooks["tool_call"]!;
  expect(toolCallHooks.length).toBe(1);

  // Test safety check interception
  const blockResult = await toolCallHooks[0]!({
    toolName: "bash",
    input: { command: "rm -rf /tmp/test" },
  });

  expect(blockResult).toBeDefined();
  expect(blockResult.block).toBe(true);
  expect(blockResult.reason).toContain("Destructive command rejected");

  const allowedResult = await toolCallHooks[0]!({
    toolName: "bash",
    input: { command: "ls -la" },
  });

  expect(allowedResult).toBeUndefined();
});
