export const pipelineState = {
  status: 'idle', // 'idle' | 'running' | 'done' | 'error' | 'cancelled'
  processed: 0,
  duration_ms: 0,
  error: null as string | null,
  // Cooperative cancellation flag: the classification loop in
  // app/api/pipeline/run/route.ts polls this at its existing progress
  // checkpoint (every 25 reviews) and self-terminates when set. There's no
  // true task-cancellation primitive wired through the classifier/DB calls,
  // so this is "request cancellation," not "kill the in-flight promise."
  cancelRequested: false
};
