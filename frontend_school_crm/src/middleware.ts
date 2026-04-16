import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  
  // Add CSP header to allow API calls to Railway backend
  const cspHeader = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.softgen.ai https://cdn.softgen.dev; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://incredible-love-production-0008.up.railway.app https://*.railway.app http://localhost:*; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com;";
  
  requestHeaders.set('Content-Security-Policy', cspHeader);
  
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  response.headers.set('Content-Security-Policy', cspHeader);
  
  return response;
}

export const config = {
  matcher: '/:path*',
};
