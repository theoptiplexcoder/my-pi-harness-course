# Lesson 5: Orchestration & Typed Handoffs

> Stop stuffing all domain knowledge into one giant prompt. Route intent to specialist agents.

---

## The Pain

Monolithic "do-everything" agents quickly fail:
- Prompt instructions conflict (e.g. "Be concise for technical queries" vs "Be empathetic for customer support").
- Tool selection becomes noisy (an agent with 50 tools frequently calls the wrong tool).
- Context becomes bloated with irrelevant domain rules.

---

## What the Harness Adds

A triage router with typed handoffs (`harness/router.ts`):
- **Triage Router (`AgentRouter`)**: Analyzes the incoming task intent.
- **Typed Handoff Contract (`Handoff`)**: Encapsulates `targetAgent`, `reason`, and sanitized `taskPacket`.
- **Specialist Isolation**: Each specialist agent (`supportSpecialist`, `securitySpecialist`) operates with focused prompts and tools.

---

## The Core Code (`harness/router.ts`)

```ts
export interface Handoff {
  targetAgent: string;
  reason: string;
  taskPacket: any;
}

export class AgentRouter {
  private specialists: Map<string, SpecialistAgent> = new Map();

  register(specialist: SpecialistAgent) {
    this.specialists.set(specialist.name, specialist);
  }

  route(intent: string, packet: any): Handoff {
    const lower = intent.toLowerCase();
    if (lower.includes("support") || lower.includes("ticket")) {
      return { targetAgent: "supportSpecialist", reason: "Support query", taskPacket: packet };
    }
    if (lower.includes("security") || lower.includes("code")) {
      return { targetAgent: "securitySpecialist", reason: "Security query", taskPacket: packet };
    }
    return { targetAgent: "generalSpecialist", reason: "Default triage", taskPacket: packet };
  }

  async executeHandoff(handoff: Handoff): Promise<any> {
    const agent = this.specialists.get(handoff.targetAgent);
    if (!agent) throw new Error(`Specialist ${handoff.targetAgent} not registered`);
    return await agent.handle(handoff.taskPacket);
  }
}
```

---

## In Production

Corresponds to **OpenAI Swarm**, **Mastra Agents**, or **LangGraph Multi-Agent Routers**.
