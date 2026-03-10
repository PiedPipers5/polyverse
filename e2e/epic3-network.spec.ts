import { test, expect } from '@playwright/test';

test.describe('Epic 3: Federated Network', () => {
    test('should redirect unauthenticated users from search to login', async ({ page }) => {
        // Navigating to /search should trigger a redirect to /login
        await page.goto('/search');
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('h1')).toContainText(/Welcome Back/i);
    });

    test('should see the Polyverse brand on the landing page', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('span.gradient-text').filter({ hasText: 'POLYVERSE' }).first()).toBeVisible();
    });
});
