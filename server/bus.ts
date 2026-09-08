import { EventEmitter } from "node:events";
import type { AgentEvent } from "../shared/events";

export class EventBus extends EventEmitter {
  emitEvent(event: AgentEvent) {
    this.emit("agent_event", event);
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.on("agent_event", listener);
    return () => this.off("agent_event", listener);
  }
}

export const globalEventBus = new EventBus();

export function createEmitter(workflowId: string, bus: EventBus = globalEventBus) {
  return (type: AgentEvent["type"], data: any) => {
    bus.emitEvent({
      type,
      workflowId,
      timestamp: Date.now(),
      data
    });
  };
}
