import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { pipelineState } from '../state';

export const dynamic = 'force-dynamic';

// Requests cancellation of an in-flight pipeline run. This does not and
// cannot kill the in-flight runPipelineBackground() promise directly (there
// is no AbortController plumbed through it) -- it only flips a cooperative
// flag that the classification loop checks at its existing progress
// checkpoint (every 25 reviews, see app/api/pipeline/run/route.ts). The
// pipeline notices and settles on its own within a few seconds.
export async function POST() {
  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (pipelineState.status !== 'running') {
    // Idempotent no-op: nothing to cancel.
    return NextResponse.json({ success: true, message: 'Nothing to cancel' });
  }

  pipelineState.cancelRequested = true;

  return NextResponse.json({ success: true, message: 'Cancel requested' });
}
