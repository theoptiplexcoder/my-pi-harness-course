export interface SpecialistAgent {
  name: string;
  description: string;
  handle: (task: any) => Promise<any>;
}

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
    if (lower.includes("support") || lower.includes("ticket") || lower.includes("customer")) {
      return {
        targetAgent: "supportSpecialist",
        reason: "Matched support keywords",
        taskPacket: packet
      };
    }

    if (lower.includes("security") || lower.includes("code") || lower.includes("vulnerability")) {
      return {
        targetAgent: "securitySpecialist",
        reason: "Matched code/security keywords",
        taskPacket: packet
      };
    }

    return {
      targetAgent: "generalSpecialist",
      reason: "Default fallback triage",
      taskPacket: packet
    };
  }

  async executeHandoff(handoff: Handoff): Promise<any> {
    const agent = this.specialists.get(handoff.targetAgent);
    if (!agent) {
      throw new Error(`Specialist ${handoff.targetAgent} not found in router registry`);
    }
    return await agent.handle(handoff.taskPacket);
  }
}
