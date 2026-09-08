import { globalEventBus, createEmitter } from "./bus";
import { AgentRuntime } from "../harness/runtime";

const port = Number(process.env.PORT || 8787);

const server = Bun.serve({
  port,
  routes: {
    "/health": {
      GET: () => new Response(JSON.stringify({ status: "ok", port }), {
        headers: { "Content-Type": "application/json" }
      })
    }
  },
  websocket: {
    open(ws) {
      ws.send(JSON.stringify({ type: "connection_established", message: "Connected to Pi Harness Gateway" }));
    },
    message(ws, message) {
      const payload = JSON.parse(typeof message === "string" ? message : message.toString());
      if (payload.action === "submit_task") {
        const workflowId = payload.workflowId || `wf-${Date.now()}`;
        const emitter = createEmitter(workflowId);
        const runtime = new AgentRuntime();
        runtime.runWorkflow(workflowId, payload.input);
      }
    }
  },
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("Harness Starter running", { status: 200 });
  }
});

console.log(`Starter server running at http://localhost:${server.port}`);
