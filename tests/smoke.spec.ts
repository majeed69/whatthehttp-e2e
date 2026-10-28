import { test, expect } from './fixtures';
import { STATIONS } from './helpers';

// Console errors and CSP violations are checked for every test by the
// failOnPageErrors fixture, so this test only has to load the page.
test('page loads with all 8 stations', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('./');

  await expect(page).toHaveTitle(/WhatTheHTTP/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What actually happens when you hit Enter.');
  await expect(page.getByLabel('Website address')).toBeVisible();

  const stationList = page.getByRole('list', { name: 'Stations on the trip' });
  await expect(stationList.getByRole('button')).toHaveCount(STATIONS.length);
  for (const [i, title] of STATIONS.entries()) {
    await expect(stationList.getByRole('button', { name: `Station ${i + 1}: ${title}` })).toBeVisible();
  }
});
