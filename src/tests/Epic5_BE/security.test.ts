import { describe, it, expect } from 'vitest';
import {
    parseSignatureHeader,
    buildSigningString,
    verifyHttpSignature
} from '../../lib/server/httpSignature';

describe('Epic 5.1: HTTP Signatures (Security)', () => {

    describe('parseSignatureHeader', () => {
        it('should parse a valid signature header', () => {
            const header = 'keyId="https://example.com/users/alice#main-key",algorithm="rsa-sha256",headers="(request-target) date host",signature="abc123def456"';
            const parsed = parseSignatureHeader(header);

            expect(parsed).not.toBeNull();
            expect(parsed?.keyId).toBe('https://example.com/users/alice#main-key');
            expect(parsed?.headers).toEqual(['(request-target)', 'date', 'host']);
            expect(parsed?.signature).toBe('abc123def456');
        });

        it('should return null for missing keyId', () => {
            const header = 'algorithm="rsa-sha256",signature="abc"';
            expect(parseSignatureHeader(header)).toBeNull();
        });

        it('should return null for malformed strings', () => {
            expect(parseSignatureHeader('not a header')).toBeNull();
        });
    });

    describe('buildSigningString', () => {
        it('should reconstruct the signing string correctly', () => {
            const headers = new Headers({
                'Date': 'Sun, 22 Feb 2026 10:00:00 GMT',
                'Host': 'polyverse.test'
            });
            const names = ['(request-target)', 'date', 'host'];
            const result = buildSigningString('POST', '/inbox', headers, names);

            expect(result).toBe(
                '(request-target): post /inbox\n' +
                'date: Sun, 22 Feb 2026 10:00:00 GMT\n' +
                'host: polyverse.test'
            );
        });
    });

    describe('verifyHttpSignature (Mocked Logic)', () => {
        // Since verifyHttpSignature uses actual node:crypto verify(), 
        // full integration testing requires valid RSA keys.
        // For the "Test Case" requirement, we verify that the flow handles errors correctly.

        it('should return error result if signature header is missing', async () => {
            const request = new Request('http://localhost/inbox', { method: 'POST' });
            const result = await verifyHttpSignature(request, {});
            expect(result.verified).toBe(false);
            expect(result.reason).toContain('No Signature header');
        });

        it('should return error result if public key cannot be extracted', async () => {
            const request = new Request('http://localhost/inbox', {
                method: 'POST',
                headers: { 'Signature': 'keyId="test",signature="abc"' }
            });
            // Actor missing publicKey field
            const result = await verifyHttpSignature(request, { id: 'test' });
            expect(result.verified).toBe(false);
            expect(result.reason).toContain('Could not extract public key');
        });
    });
});
