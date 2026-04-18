import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // CSP is set via next.config.js headers() — no need to duplicate it here.
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
