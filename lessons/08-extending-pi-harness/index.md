# Lesson 8: Extending the Pi Harness — Custom Tools, Extensions, Agents, & Skills

This lesson covers how the **Pi Coding Agent Harness** (`@earendil-works/pi-coding-agent`) is architected internally and how you can use its native endpoints and extension APIs to build **Custom Tools**, **Event Interceptors**, **Custom Commands**, **Specialized Subagents**, and **Agent Skills**.

---

## 1. Architectural Overview of the Pi Harness

The Pi Harness operates as a layered system:

```
┌────────────────────────────────────────────────────────┐
│               Interactive TUI / RPC Server             │
├────────────────────────────────────────────────────────┤
│                  AgentSessionRuntime                   │
│   • Session replacement (newSession, switch, fork)     │
│   • Resource lifecycle (rebuilding cwd-bound state)   │
├────────────────────────────────────────────────────────┤
│                      AgentSession                      │
│   • Event streaming (`session.subscribe`)              │
│   • Message queueing (`steer`, `followUp`)             │
│   • Compaction & tree branching (`session.compact`)    │
├────────────────────────────────────────────────────────┤
│                 DefaultResourceLoader                  │
│   • Tools, Extensions, Skills, Prompts, Themes         │
├────────────────────────────────────────────────────────┤
│               Agent & ModelRuntime (Pi AI)             │
│   • Low-level loop (Prompt → LLM → Tools → Response)   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Building Custom Tools via the Extension API

In Pi, custom tools are created by registering them through an `ExtensionFactory` or an extension file exporting a default function: `export default function (pi: ExtensionAPI)`.

### Tool Definition Schema using TypeBox

Pi uses TypeBox (`typebox`) for compile-time and runtime JSON Schema validation:

```ts
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerWeatherTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "getWeather",
    label: "Get Weather",
    description: "Fetches current weather conditions for a given city",
    parameters: Type.Object({
      city: Type.String({ description: "Target city name" }),
      // Note: Use StringEnum from @earendil-works/pi-ai for compatibility with Google/Gemini models
      units: Type.Optional(StringEnum(["celsius", "fahrenheit"] as const, { description: "Temperature unit" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Periodic progress updates can be streamed back
      onUpdate?.({ content: [{ type: "text", text: `Querying weather for ${params.city}...` }] });

      return {
        content: [{ type: "text", text: `Weather in ${params.city}: 22°C, Clear` }],
        details: { city: params.city, temp: 22, conditions: "Clear" },
      };
    },
  });
}
```

---

## 3. Tool Policy & Event Interception

Extensions can intercept lifecycle hooks to block or confirm dangerous actions:

```ts
pi.on("tool_call", async (event, ctx) => {
  // Block any dangerous shell invocation
  if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    return {
      block: true,
      reason: "Blocked by safety extension: destructive commands not permitted.",
    };
  }
  return undefined; // Allowed
});
```

---

## 4. Building Custom Skills

Pi supports the [Agent Skills specification](https://agentskills.io/specification). Skills are directories containing a `SKILL.md` file with YAML frontmatter:

```
.pi/skills/database-audit/
├── SKILL.md
└── scripts/
    └── check-indexes.sh
```

### `SKILL.md` Example:
```markdown
---
name: database-audit
description: Check SQLite/PostgreSQL schemas for unindexed foreign keys and slow query patterns
allowed-tools: read bash
---

# Database Audit Skill
When invoked:
1. Examine schema files or query `sqlite_master`.
2. Report missing indices.
```

The harness exposes skills as progressive disclosure: descriptions are indexed in the system prompt, while full instructions are read on-demand via `read` or triggered with `/skill:database-audit`.

---

## 5. Spawning Specialized Sub-Agents via the SDK

To spawn isolated or parallel subagents within your harness:

```ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

export async function runSubagent(role: "scout" | "reviewer", prompt: string, cwd: string = process.cwd()) {
  const allowedTools = role === "scout"
    ? ["read", "grep", "find", "ls"]
    : ["read", "grep"];

  const { session } = await createAgentSession({
    cwd,
    tools: allowedTools,
    sessionManager: SessionManager.inMemory(cwd),
  });

  try {
    let output = "";
    session.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        output += event.assistantMessageEvent.delta;
      }
    });

    await session.prompt(prompt);
    return output;
  } finally {
    session.dispose();
  }
}
```

---

## 6. Programmatic Inline Registration in Custom Harnesses

You can configure `DefaultResourceLoader` with inline extension factories to directly wire your custom tools, policies, and commands without writing separate files:

```ts
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  extensionFactories: [
    (pi) => {
      // 1. Register custom tool
      pi.registerTool({
        name: "calculateMetric",
        label: "Calculate Metric",
        description: "Calculates performance metrics",
        parameters: Type.Object({ value: Type.Number() }),
        execute: async (_id, params) => ({
          content: [{ type: "text", text: `Metric result: ${params.value * 2}` }],
          details: { result: params.value * 2 },
        }),
      });

      // 2. Register custom slash command
      pi.registerCommand("status", {
        description: "Show system health",
        handler: async (_args, ctx) => {
          ctx.ui.notify("Harness status: healthy", "info");
        },
      });

      // 3. Register guardrail hook
      pi.on("tool_call", async (event) => {
        if (event.toolName === "calculateMetric" && event.input.value < 0) {
          return { block: true, reason: "Negative values not allowed" };
        }
      });
    },
  ],
});

await resourceLoader.reload();

const { session } = await createAgentSession({
  resourceLoader,
  sessionManager: SessionManager.inMemory(),
});
```
