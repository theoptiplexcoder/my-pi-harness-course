// STUB in the starter - filled in Lesson 1
export class AgentRuntime {
  async runWorkflow(workflowId: string, input?: any): Promise<any> {
    console.log(`[STUB] Workflow ${workflowId} called with input:`, input);
    return { done: true, message: "Stub runtime. Complete Lesson 1 to build the agent harness loop!" };
  }
}
