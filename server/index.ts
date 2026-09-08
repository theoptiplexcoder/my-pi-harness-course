import { globalEventBus, createEmitter } from "./bus";
import { AgentRuntime } from "../harness/runtime";
import { StateStore } from "../harness/state";
import { ApprovalStore } from "../harness/approvals";

const port = Number(process.env.PORT || 8787);
const dbPath = process.env.DB_PATH || "harness.db";

// Shared persistent singletons across WebSocket connections
const stateStore = new StateStore(dbPath);
const approvalStore = new ApprovalStore(dbPath);

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
      try {
        const payload = JSON.parse(typeof message === "string" ? message : message.toString());

        if (payload.action === "submit_task") {
          const workflowId = payload.workflowId || `wf-${Date.now()}`;
          const emitter = createEmitter(workflowId);
          const runtime = new AgentRuntime({
            stateStore,
            approvalStore,
            emit: (type, data) => {
              emitter(type as any, data);
              ws.send(JSON.stringify({ type, workflowId, data, timestamp: Date.now() }));
            }
          });

          runtime.runWorkflow(workflowId, payload.input).catch(err => {
            ws.send(JSON.stringify({ type: "error", workflowId, error: err.message }));
          });
        } else if (payload.action === "approve" || payload.action === "reject") {
          const workflowId = payload.workflowId;
          const approvalId = payload.approvalId;
          const approved = payload.action === "approve";

          const emitter = createEmitter(workflowId);
          const runtime = new AgentRuntime({
            stateStore,
            approvalStore,
            emit: (type, data) => {
              emitter(type as any, data);
              ws.send(JSON.stringify({ type, workflowId, data, timestamp: Date.now() }));
            }
          });

          runtime.resumeWorkflow(workflowId, approvalId, approved).catch(err => {
            ws.send(JSON.stringify({ type: "error", workflowId, error: err.message }));
          });
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: "error", error: err.message }));
      }
    },
    close() {
      // client disconnected
    }
  },
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // upgraded to websocket
    }
    return new Response("Pi Harness Server running. Connect via WebSocket or /health", { status: 200 });
  }
});

console.log(`Harness server running at http://localhost:${server.port}`);

