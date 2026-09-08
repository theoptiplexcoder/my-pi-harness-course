export interface ToolCallStep {
  tool: string;
  params: Record<string, any>;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export interface ToolPolicy {
  check(step: ToolCallStep): Promise<PolicyCheckResult>;
}

export class DefaultToolPolicy implements ToolPolicy {
  private allowedPaths: string[];
  private blockedCommands: RegExp[];

  constructor(options?: { allowedPaths?: string[]; blockedCommands?: RegExp[] }) {
    this.allowedPaths = options?.allowedPaths || ["/tmp", "./workspace", "./data"];
    this.blockedCommands = options?.blockedCommands || [
      /rm\s+-rf/,
      /curl\s+.*\|\s*sh/,
      />\s*\/etc\//,
      /\.env/,
    ];
  }

  async check(step: ToolCallStep): Promise<PolicyCheckResult> {
    // Dangerous tool approval requirement
    if (["sendMessage", "updateRecord", "createTicket"].includes(step.tool)) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Tool '${step.tool}' modifies external state and requires human approval.`
      };
    }

    // Code execution policy & path security
    if (step.tool === "runCode") {
      const code = step.params?.code || "";
      for (const pattern of this.blockedCommands) {
        if (pattern.test(code)) {
          return {
            allowed: false,
            requiresApproval: false,
            reason: `Execution blocked by ToolPolicy: command violates security pattern ${pattern.toString()}`
          };
        }
      }
    }

    return { allowed: true };
  }
}
