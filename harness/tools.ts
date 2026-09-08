export interface ToolDefinition<P = any, R = any> {
  name: string;
  description: string;
  isDangerous?: boolean;
  execute: (params: P) => Promise<R>;
}

// In-memory mock knowledge base and items
const mockKnowledgeBase: Record<string, string> = {
  "refund_policy": "Full refunds permitted within 30 days of purchase upon proof of purchase.",
  "security_guidelines": "Never expose API keys or credentials in logs or public messages.",
  "deployment_checklist": "Ensure tests pass, check database migrations, and obtain peer review."
};

export const safeTools: Record<string, ToolDefinition> = {
  searchKnowledgeBase: {
    name: "searchKnowledgeBase",
    description: "Search internal knowledge base articles and guidelines",
    isDangerous: false,
    execute: async ({ query }: { query: string }) => {
      const matchKey = Object.keys(mockKnowledgeBase).find(k => k.includes(query.toLowerCase()) || query.toLowerCase().includes(k));
      return {
        found: true,
        content: matchKey ? mockKnowledgeBase[matchKey] : "No explicit match found. Follow standard protocols."
      };
    }
  },
  summarizeDocument: {
    name: "summarizeDocument",
    description: "Summarize a raw text document",
    isDangerous: false,
    execute: async ({ text }: { text: string }) => {
      return { summary: `Summary: ${text.slice(0, 100)}...` };
    }
  },
  classifyItem: {
    name: "classifyItem",
    description: "Classify incoming task packet item into priority and category",
    isDangerous: false,
    execute: async ({ item }: { item: string }) => {
      const priority = item.toLowerCase().includes("urgent") || item.toLowerCase().includes("crash") ? "high" : "normal";
      return { category: "operations", priority };
    }
  },
  createDraft: {
    name: "createDraft",
    description: "Create an internal draft record or memo",
    isDangerous: false,
    execute: async ({ title, body }: { title: string; body: string }) => {
      return { id: `draft-${Date.now()}`, title, status: "draft_created" };
    }
  }
};

export const dangerousTools: Record<string, ToolDefinition> = {
  runCode: {
    name: "runCode",
    description: "Execute arbitrary script/code in an environment",
    isDangerous: true,
    execute: async ({ code }: { code: string }) => {
      return { output: `Executed code: ${code}` };
    }
  },
  sendMessage: {
    name: "sendMessage",
    description: "Send a message to an external party or customer",
    isDangerous: true,
    execute: async ({ recipient, message }: { recipient: string; message: string }) => {
      return { delivered: true, recipient, messageId: `msg-${Date.now()}` };
    }
  },
  updateRecord: {
    name: "updateRecord",
    description: "Mutate database records or external state",
    isDangerous: true,
    execute: async ({ recordId, changes }: { recordId: string; changes: Record<string, any> }) => {
      return { updated: true, recordId, changes };
    }
  },
  createTicket: {
    name: "createTicket",
    description: "Create an external billing or support ticket",
    isDangerous: true,
    execute: async ({ title, priority }: { title: string; priority: string }) => {
      return { ticketId: `TICKET-${Math.floor(Math.random() * 10000)}`, title, priority };
    }
  }
};

export const allTools = { ...safeTools, ...dangerousTools };
