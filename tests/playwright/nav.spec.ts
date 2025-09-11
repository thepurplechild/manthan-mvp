import { test, expect } from '@playwright/test'

test('unauthenticated dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/login|\/login/)
})

test('404 page shown for invalid route', async ({ page }) => {
  await page.goto('/this-route-does-not-exist')
  await expect(page.getByText('404')).toBeVisible()
})

test.skip('signup → dashboard → create project → projects → logout (stub)', async ({ page }) => {
  // Provide E2E_EMAIL/E2E_PASSWORD to run this flow or implement a test user seeding step.
})

