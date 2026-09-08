import {
  DefaultResourceLoader,
  getAgentDir,
  type ExtensionAPI
} from "@earendil-works/pi-coding-agent";

export function createAuditToolExtension() {
  return (pi: ExtensionAPI) => {
    // 1. Tool Call Policy Guard
    pi.on("tool_call", async (event) => {
      const command = (event.input as Record<string, any>)?.command;
      if (event.toolName === "bash" && typeof command === "string" && command.includes("rm -rf")) {
        return {
          block: true,
          reason: "Destructive command rejected by AuditExtension"
        };
      }
      return undefined;
    });

    // 2. Custom Command
    pi.registerCommand("harness-info", {
      description: "Outputs harness metadata",
      handler: async (_args, ctx) => {
        ctx.ui.notify("Custom Pi Harness v1.0 running", "info");
      }
    });
  };
}

export async function createCustomResourceLoader(cwd: string = "/tmp", agentDir: string = "/tmp") {
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    extensionFactories: [createAuditToolExtension()],
  });

  await loader.reload();
  return loader;
}
