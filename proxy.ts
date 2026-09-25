import {NextResponse} from 'next/server';
export function proxy(){const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');return response;}
export const config={matcher:['/preview/:path*','/invite/:path*','/onboarding']};
