export const pipelineState = {
  status: 'idle', // 'idle' | 'running' | 'done' | 'error'
  processed: 0,
  duration_ms: 0,
  error: null as string | null
};
