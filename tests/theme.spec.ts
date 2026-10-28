import { test, expect } from './fixtures';

// --paper in style.css, used as the page background
const LIGHT_BG = 'rgb(245, 240, 230)';
const DARK_BG = 'rgb(17, 19, 26)';

// Playwright emulates a light system theme by default, so every test starts
// in light mode unless it says otherwise. The page background is set on
// <body>, which has no role, so it's located by tag name.

test('theme toggle switches between light and dark', async ({ page }) => {
  await page.goto('./');
  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', LIGHT_BG);

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(body).toHaveCSS('background-color', DARK_BG);

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(body).toHaveCSS('background-color', LIGHT_BG);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});

test('theme choice survives a reload', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();

  await page.reload();

  await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('follows the system theme when nothing is saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');

  await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

// CSS alone would repaint the background here. The button label only
// changes if the app's matchMedia listener runs, so that's what this checks.
test('follows a system theme change while the page is open', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

  await page.emulateMedia({ colorScheme: 'dark' });

  await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('a saved choice wins over the system theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();

  await page.reload();

  await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});
