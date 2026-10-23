import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST = 'fee-log26.vercel.app';

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname;

  if (hostname.endsWith('.vercel.app') && hostname !== CANONICAL_HOST) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = 'https:';
    canonicalUrl.hostname = CANONICAL_HOST;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
