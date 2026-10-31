import type { AssistantInput, AssistantPlan, PlannerOptions } from './types';

/** 每次只保留一個搜尋；關閉面板時直接終止運算，不留下延遲操作。 */
export class AssistantPlannerClient {
  private pending?: { worker: Worker; finish: (plan: AssistantPlan | null) => void };

  plan(input: AssistantInput, options: PlannerOptions = {}): Promise<AssistantPlan | null> {
    this.cancel();
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => finish(null), 15000);
      const finish = (plan: AssistantPlan | null, error?: Error) => {
        clearTimeout(timer);
        worker.terminate();
        if (this.pending?.worker === worker) this.pending = undefined;
        if (error) reject(error); else resolve(plan);
      };
      this.pending = { worker, finish };
      worker.onmessage = (event: MessageEvent<{ plan?: AssistantPlan; error?: string }>) => {
        if (event.data.error) finish(null, new Error(event.data.error));
        else finish(event.data.plan ?? null);
      };
      worker.onerror = () => finish(null, new Error('轉珠規劃暫時無法完成，請再試一次。'));
      worker.postMessage({ input, options: { beamWidth: 48, timeBudgetMs: 1800, maxSteps: 40, stepsPerSecond: 8, ...options } });
    });
  }

  cancel(): void { this.pending?.finish(null); }
}
