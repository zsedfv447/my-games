import { planAssistantMove } from './planner';
import type { AssistantInput, PlannerOptions } from './types';

self.onmessage = (event: MessageEvent<{ input: AssistantInput; options: PlannerOptions }>) => {
  try {
    self.postMessage({ plan: planAssistantMove(event.data.input, event.data.options) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '轉珠規劃失敗' });
  }
};
