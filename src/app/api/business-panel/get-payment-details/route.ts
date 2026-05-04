// This file is no longer needed as the logic is now handled client-side.
// Deleting the file to avoid confusion and potential errors.

import {NextResponse} from 'next/server';

export async function GET(request: Request) {
  return NextResponse.json({error: 'This API endpoint is deprecated.'}, {status: 410});
}
