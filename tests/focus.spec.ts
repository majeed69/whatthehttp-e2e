import { test, expect } from './fixtures';
import { startTrip, expectStation, stationButton } from './helpers';
import type { Locator } from '@playwright/test';

async function expectFocusRing(control: Locator) {
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS('outline-style', 'solid');
  await expect(control).toHaveCSS('outline-width', '3px');
}

test('tabbing through the start page shows a focus ring on every control', async ({ page }) => {
  await page.goto('./');
  const input = page.getByLabel('Website address');
  // The input has outline: 0. Its focus style is on the address bar around
  // it, which has no role or name, so this needs a CSS selector.
  const addressBar = page.locator('.address-bar');
  const unfocusedShadow = await addressBar.evaluate((el) => getComputedStyle(el).boxShadow);

  const before = [
    page.getByRole('link', { name: 'Skip to content' }),
    page.getByRole('link', { name: 'WhatTheHTTP, start over' }),
    page.getByRole('button', { name: 'Simple' }),
    page.getByRole('button', { name: 'Engineer' }),
    page.getByRole('button', { name: 'Switch to dark theme' }),
  ];
  for (const control of before) {
    await page.keyboard.press('Tab');
    await expectFocusRing(control);
  }

  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await expect(addressBar).not.toHaveCSS('box-shadow', unfocusedShadow);

  const after = [
    page.getByRole('button', { name: 'Enter', exact: true }),
    page.getByRole('button', { name: 'google.com' }),
    page.getByRole('button', { name: 'wikipedia.org' }),
    page.getByRole('button', { name: 'github.com' }),
    page.getByRole('link', { name: 'Source on GitHub' }),
  ];
  for (const control of after) {
    await page.keyboard.press('Tab');
    await expectFocusRing(control);
  }
});

test('tabbing through the trip controls shows a focus ring on every control', async ({ page }) => {
  await startTrip(page);
  // Move off station 1 so Previous is enabled and part of the tab order.
  await page.keyboard.press('ArrowRight');
  await expectStation(page, 2);

  const newTrip = page.getByRole('button', { name: 'New trip' });
  await newTrip.focus();
  await expectFocusRing(newTrip);

  const controls = [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => stationButton(page, n)),
    page.getByRole('button', { name: 'Previous station' }),
    page.getByRole('button', { name: 'Pause', exact: true }),
    page.getByRole('button', { name: 'Next station' }),
    page.getByRole('button', { name: 'Replay from the start' }),
    page.getByRole('button', { name: 'Speed: 1x. Switch to 2x' }),
  ];
  for (const control of controls) {
    await page.keyboard.press('Tab');
    await expectFocusRing(control);
  }
});

// Known site bug, found while writing this suite: when Next gets disabled at
// the last station it still has focus, so focus falls back to <body> and
// nothing on screen is focused. test.fail() keeps the suite green and will
// flag this test as soon as the site is fixed.
test('focus stays on a visible control when Next reaches the last station', async ({ page }) => {
  test.fail();
  await startTrip(page);
  await page.getByRole('button', { name: 'Next station' }).focus();

  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter');
  await expectStation(page, 8);

  // There is no role-based way to ask "what has focus", hence :focus.
  await expect(page.locator(':focus')).toBeVisible({ timeout: 1_000 });
});
