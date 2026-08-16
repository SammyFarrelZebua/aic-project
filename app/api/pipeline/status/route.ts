import { NextResponse } from 'next/server';
import { pipelineState } from '../state';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: pipelineState
  });
}
