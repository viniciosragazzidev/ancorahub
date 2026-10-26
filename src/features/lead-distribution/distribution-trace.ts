/**
 * Last step reached by each lead being distributed in this process (26/10). Some leads never
 * finished processing and held the job; when one passes its time limit the job logs this step.
 */
const TRACE_KEY = Symbol.for("ancorahub.lead-distribution.trace");
const store = globalThis as typeof globalThis & { [TRACE_KEY]?: Map<string, { step: string; at: number }> };
const traces = (store[TRACE_KEY] ??= new Map());

export function traceLeadStep(leadId: string, step: string) {
  traces.set(leadId, { step, at: Date.now() });
}

export function readLeadTrace(leadId: string) {
  return traces.get(leadId);
}

export function clearLeadTrace(leadId: string) {
  traces.delete(leadId);
}
