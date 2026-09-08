# Lesson 7: Human-in-the-Loop & Suspended Workflows

> Pause execution safely before high-stakes actions, wait days for approval, and resume cleanly.

---

## The Pain

Autonomous agents should not deploy to production, send external customer emails, or issue refunds without human confirmation.

However, standard async functions cannot pause for hours or days waiting for an HTTP callback without holding open expensive memory connections that will be killed on deploy.

---

## What the Harness Adds

Durable suspend and resume semantics:
- **`ApprovalStore` (`harness/approvals.ts`)**: Persists approval requests with `workflowId`, `stepIndex`, `tool`, and arguments into SQLite.
- **Workflow Suspension**: When a dangerous tool (`sendMessage`, `updateRecord`) is detected, the harness logs `approval_required` and suspends the workflow cleanly.
- **Resumption via Signal**: When a human clicks "Approve" via WebSocket or REST, `resumeWorkflow` reloads the exact state, executes the approved step, and continues the remainder of the loop.

---

## The Core Code

### Suspending on Dangerous Action (`harness/runtime.ts`)
```ts
if (check.requiresApproval) {
  const approval = await this.approvalStore.createRequest({
    id: `appr-${Date.now()}-${state.stepIndex}`,
    workflowId,
    stepIndex: state.stepIndex,
    tool: step.tool,
    params: step.params,
  });

  this.emit("approval_required", { approval, step });
  return state; // Suspends execution safely!
}
```

### Resuming upon Human Approval (`harness/runtime.ts`)
```ts
async resumeWorkflow(workflowId: string, approvalId: string, approved: boolean): Promise<WorkflowState> {
  await this.approvalStore.resolve(approvalId, approved ? "approved" : "rejected");
  if (approved) {
    const result = await allTools[approval.tool].execute(approval.params);
    // update state and resume execution loop
    return this.runWorkflow(workflowId);
  }
}
```

---

## In Production

Corresponds to **Temporal Signals & Queries**, **Inngest `waitForEvent`**, or human approval webhooks.
