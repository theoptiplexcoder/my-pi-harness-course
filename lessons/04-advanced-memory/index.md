# Lesson 4: Advanced Memory & Compaction

> Keep agents focused and fast over long conversations without blowing the context window.

---

## The Pain

As an agent works across 20+ turns:
1. **Context Window Overflow**: Token usage grows linearly until hitting model context limits.
2. **"Needle in a Haystack" Attention Degradation**: As prompts grow to 50k+ tokens, models start hallucinating or forgetting initial system instructions.
3. **Exploding Latency and Cost**: Every turn resends tens of thousands of tokens of old tool logs.

---

## What the Harness Adds

Pi's context hydration and compaction algorithm:
- **Sliding History Window (`DefaultMemoryHydrator`)**: Keeps only the most recent N actions in hot memory.
- **Compaction Algorithm**: Automatically triggers when message history crosses threshold limits. It identifies safe turn cut points, summarizes older steps, and preserves a concise context block.
- **Hydration on Demand**: Injects dynamic state, summaries, and tool outputs right before the next LLM call.

---

## The Core Code (`harness/memory.ts`)

```ts
export class DefaultMemoryHydrator implements ContextHydrator {
  private windowSize: number;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
  }

  compact(history: any[]): { kept: any[]; summary: string } {
    if (history.length <= this.windowSize) {
      return { kept: history, summary: "" };
    }

    const cutPoint = history.length - this.windowSize;
    const toSummarize = history.slice(0, cutPoint);
    const kept = history.slice(cutPoint);

    const summary = `Compacted ${toSummarize.length} older steps. Actions: ${toSummarize.map(s => s.tool).join(", ")}`;
    return { kept, summary };
  }
}
```

---

## In Production

Matches **LangGraph Checkpoint Memory**, **MemGPT**, or the native **Pi compaction engine** (`CompactionEntry` in `.jsonl` session trees).

---

## Reference & Documentation

To see how history summarization, token window management, and compaction work in Pi:
- **Compaction Guide**: [`docs/compaction.md`](../../node_modules/@earendil-works/pi-coding-agent/docs/compaction.md)
- **Session Format Specification**: [`docs/session-format.md`](../../node_modules/@earendil-works/pi-coding-agent/docs/session-format.md)
- **Compaction Engine Types**: [`dist/core/compaction/index.d.ts`](../../node_modules/@earendil-works/pi-coding-agent/dist/core/compaction/index.d.ts)

