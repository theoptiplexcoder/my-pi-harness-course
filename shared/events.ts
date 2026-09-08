export type AgentEventType =
  | "workflow_start"
  | "workflow_step"
  | "workflow_end"
  | "agent_start"
  | "agent_end"
  | "text_delta"
  | "tool_call_start"
  | "tool_call_end"
  | "checkpoint_saved"
  | "policy_blocked"
  | "approval_required"
  | "approval_resolved";

export interface AgentEvent<T = any> {
  type: AgentEventType;
  workflowId: string;
  timestamp: number;
  data: T;
}
