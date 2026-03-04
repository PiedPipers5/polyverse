/**
 * HTTP Signature Verification Module
 * Task 3.3.2: Basic structural validation of HTTP Signatures
 *
 * Implements draft-cavage-http-signatures parsing and verification.
 * At this stage (pre-Epic 5), verification failures are logged but
 * do NOT reject the request — full enforcement comes later.
 *
 * @see https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures
 */

import { createVerify } from 'node:crypto';
import * as jose from 'jose';

/**
 * Parsed components of an HTTP Signature header.
 */
export interface ParsedSignature {
	keyId: string;
	algorithm: string;
	headers: string[];
	signature: string;
}

/**
 * Result of HTTP Signature verification.
 */
export interface SignatureVerificationResult {
	verified: boolean;
	keyId: string;
	reason?: string;
}

/**
 * Parses the HTTP `Signature` header string into its components.
 *
 * Format: keyId="...",algorithm="...",headers="...",signature="..."
 *
 * @param header - The raw Signature header value
 * @returns Parsed signature components, or null if malformed
 */
export function parseSignatureHeader(header: string): ParsedSignature | null {
	try {
		const params: Record<string, string> = {};

		// Match key="value" pairs (handles escaped quotes)
		const regex = /(\w+)="([^"]*?)"/g;
		let match;
		while ((match = regex.exec(header)) !== null) {
			params[match[1]] = match[2];
		}

		if (!params.keyId || !params.signature) {
			return null;
		}

		return {
			keyId: params.keyId,
			algorithm: params.algorithm || 'rsa-sha256',
			headers: (params.headers || '(request-target)').split(' '),
			signature: params.signature
		};
	} catch {
		return null;
	}
}

/**
 * Reconstructs the signing string from request data and parsed signature headers.
 *
 * @param method    - HTTP method (e.g., "POST")
 * @param path      - Request path (e.g., "/users/alice/inbox")
 * @param headers   - Request headers
 * @param signedHeaderNames - Header names listed in the signature's "headers" param
 * @returns The reconstructed signing string
 */
export function buildSigningString(
	method: string,
	path: string,
	headers: Headers,
	signedHeaderNames: string[]
): string {
	const lines: string[] = [];

	for (const name of signedHeaderNames) {
		if (name === '(request-target)') {
			lines.push(`(request-target): ${method.toLowerCase()} ${path}`);
		} else {
			const value = headers.get(name);
			if (value !== null) {
				lines.push(`${name}: ${value}`);
			}
		}
	}

	return lines.join('\n');
}

/**
 * Extracts a PEM public key from an Actor JSON object.
 * Supports both `publicKeyPem` (standard Mastodon) and `publicKeyJwk` (our DID-based format).
 *
 * @param actorJson - The remote Actor JSON-LD object
 * @returns PEM-encoded public key string, or null if not found
 */
export async function extractPublicKey(
	actorJson: Record<string, unknown>
): Promise<string | null> {
	const publicKey = actorJson.publicKey as Record<string, unknown> | undefined;
	if (!publicKey) return null;

	// Standard ActivityPub: publicKeyPem
	if (typeof publicKey.publicKeyPem === 'string') {
		return publicKey.publicKeyPem;
	}

	// Our DID-based format: publicKeyJwk → convert to PEM via jose
	if (publicKey.publicKeyJwk && typeof publicKey.publicKeyJwk === 'object') {
		try {
			const key = await jose.importJWK(publicKey.publicKeyJwk as jose.JWK, 'EdDSA');
			const exported = await jose.exportSPKI(key as CryptoKey);
			return exported;
		} catch {
			return null;
		}
	}

	return null;
}

/**
 * Verifies an HTTP Signature against the request and the remote actor's public key.
 *
 * @param request   - The incoming Request object
 * @param actorJson - The remote Actor's JSON-LD object (must include publicKey)
 * @returns Verification result with { verified, keyId, reason }
 */
export async function verifyHttpSignature(
	request: Request,
	actorJson: Record<string, unknown>
): Promise<SignatureVerificationResult> {
	// 1. Extract the Signature header
	const signatureHeader = request.headers.get('signature');
	if (!signatureHeader) {
		return { verified: false, keyId: '', reason: 'No Signature header present' };
	}

	// 2. Parse the Signature header
	const parsed = parseSignatureHeader(signatureHeader);
	if (!parsed) {
		return { verified: false, keyId: '', reason: 'Malformed Signature header' };
	}

	// 3. Extract the public key from the actor
	const publicKeyPem = await extractPublicKey(actorJson);
	if (!publicKeyPem) {
		return {
			verified: false,
			keyId: parsed.keyId,
			reason: 'Could not extract public key from actor'
		};
	}

	// 4. Reconstruct the signing string
	const url = new URL(request.url);
	const signingString = buildSigningString(
		request.method,
		url.pathname,
		request.headers,
		parsed.headers
	);

	// 5. Verify the signature
	try {
		const verifier = createVerify('RSA-SHA256');
		verifier.update(signingString);
		verifier.end();

		const signatureBuffer = Buffer.from(parsed.signature, 'base64');
		const isValid = verifier.verify(publicKeyPem, signatureBuffer);

		return {
			verified: isValid,
			keyId: parsed.keyId,
			reason: isValid ? undefined : 'Signature did not match'
		};
	} catch (err) {
		return {
			verified: false,
			keyId: parsed.keyId,
			reason: `Verification error: ${err instanceof Error ? err.message : 'unknown'}`
		};
	}
}
