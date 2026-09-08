import type { WorkflowState } from "./state";

export interface ContextHydrator {
  hydrate(state: WorkflowState): Promise<string>;
}

export class DefaultMemoryHydrator implements ContextHydrator {
  private windowSize: number;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
  }

  async hydrate(state: WorkflowState): Promise<string> {
    const history = state.context.history || [];
    const recent = history.slice(-this.windowSize);

    const memoryBlocks: string[] = [
      `System Context: Current Step ${state.stepIndex}.`,
    ];

    if (state.context.summary) {
      memoryBlocks.push(`Previous Summary: ${state.context.summary}`);
    }

    if (recent.length > 0) {
      memoryBlocks.push(
        `Recent Events:\n${recent.map((item: any, idx: number) => `[${idx + 1}] ${JSON.stringify(item)}`).join("\n")}`
      );
    }

    if (state.lastResult) {
      memoryBlocks.push(`Last Execution Result: ${JSON.stringify(state.lastResult)}`);
    }

    return memoryBlocks.join("\n\n");
  }

  // Mimics Pi's compaction logic: summarize older history when exceeding threshold
  compact(history: any[], summaryPrompt?: string): { kept: any[]; summary: string } {
    if (history.length <= this.windowSize) {
      return { kept: history, summary: "" };
    }

    const cutPoint = history.length - this.windowSize;
    const toSummarize = history.slice(0, cutPoint);
    const kept = history.slice(cutPoint);

    const summary = `Compacted ${toSummarize.length} older steps. Actions performed: ${toSummarize.map(s => s.tool || "step").join(", ")}`;
    return { kept, summary };
  }
}
