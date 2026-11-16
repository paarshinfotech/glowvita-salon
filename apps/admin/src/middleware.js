import { NextResponse } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN;

async function verifyJwt(token) {
  if (!token || !JWT_SECRET_ADMIN) return null;
  const secret = new TextEncoder().encode(JWT_SECRET_ADMIN);
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (error) {
    // This will catch errors for expired tokens, invalid signatures, etc.
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Handle CORS for API routes ─────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Vary', 'Origin');
      } else {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Admin-Authorization, Vendor-Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
      return response;
    }

    const response = NextResponse.next();
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Vary', 'Origin');
    } else {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Admin-Authorization, Vendor-Authorization');
    return response;
  }

  const token = request.cookies.get('admin_access_token')?.value;

  const isAuthPage = pathname === '/login' || pathname === '/forgot-password' || pathname.startsWith('/reset-password');

  // Allow static files and Next.js internal assets
  if (pathname.includes('.') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  const payload = await verifyJwt(token);

  if (isAuthPage) {
    // If the user is on an auth page and has a valid token, redirect to dashboard
    if (payload) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } else {
    // If the user is on any other page and does NOT have a valid token, redirect to login
    if (!payload) {
      // Clear the invalid cookie if it exists
      const response = NextResponse.redirect(new URL('/login', request.url));
      if (token) {
        response.cookies.set('admin_access_token', '', { expires: new Date(0) });
      }
      return response;
    }
  }

  return NextResponse.next();
}

// Match all routes except Next.js static files and images
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
