import * as jose from 'jose';
import { env } from '$env/dynamic/private';

// Ensure JWT secret exists
if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from .env');
}

// Convert secret to Uint8Array for jose
const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * JWT payload structure
 */
export interface JWTPayload {
    userId: string;
    did: string;
    username: string;
}

/**
 * Creates a signed JWT token for authenticated users.
 * Token expires in 7 days.
 */
export async function createToken(payload: JWTPayload): Promise<string> {
    const token = await new jose.SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

    return token;
}

/**
 * Verifies a JWT token and returns the payload.
 * Throws if token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
    try {
        const { payload } = await jose.jwtVerify(token, secret);
        
        return {
            userId: payload.userId as string,
            did: payload.did as string,
            username: payload.username as string,
        };
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Cookie configuration for auth token
 */
export const AUTH_COOKIE_NAME = 'auth_token';

export const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
};
