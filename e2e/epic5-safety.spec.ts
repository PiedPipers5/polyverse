import { test, expect } from '@playwright/test';

test.describe('Epic 5: Trust & Safety', () => {
    test('should verify the presence of safety metadata (NodeInfo)', async ({ page }) => {
        // Test .well-known/nodeinfo
        const response1 = await page.request.get('/.well-known/nodeinfo');
        expect(response1.ok()).toBeTruthy();
        const info = await response1.json();
        expect(info.links).toBeDefined();

        // Find the 2.0 href
        const link20 = info.links.find((l: any) => l.rel.includes('2.0'));
        expect(link20).toBeDefined();

        // Test the actual nodeinfo 2.0 endpoint (using local path)
        const response2 = await page.request.get('/api/nodeinfo/2.0');
        expect(response2.ok()).toBeTruthy();
        const json = await response2.json();
        expect(json.software).toBeDefined();
        expect(json.usage).toBeDefined();
    });

    test('should verify that moderation API is protected', async ({ page, request }) => {
        // Direct API call without cookies should fail with 401
        const response = await request.post('/api/moderation/block', {
            data: { handle: 'alice' }
        });
        expect(response.status()).toBe(401);
    });
});
