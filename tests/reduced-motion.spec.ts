import { test, expect } from './fixtures';
import { startTrip, expectStation } from './helpers';
import type { Page } from '@playwright/test';

const unfinishedAnimations = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter((a) => a.playState !== 'finished').length);

test('a trip starts paused and tells screen readers why', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startTrip(page);

  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  // The announcement is set after a 50 ms timeout, and the clock is frozen.
  await page.clock.runFor(100);
  await expect(page.getByText('Autoplay is off because your system prefers reduced motion.')).toBeAttached();

  await page.clock.runFor(60_000);
  await expectStation(page, 1);
});

test('turning on reduced motion during a trip pauses it', async ({ page }) => {
  await startTrip(page);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });

  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await page.clock.runFor(60_000);
  await expectStation(page, 1);
});

// The progress bar is aria-hidden and has no role, so it needs a CSS selector.
test('the progress bar is hidden', async ({ page }) => {
  await startTrip(page);
  const progress = page.locator('.progress');
  await expect(progress).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });

  await expect(progress).toBeHidden();
});

// The page clock doesn't drive CSS animations, so this asks the browser
// directly through the Web Animations API. The first check proves the
// measurement can see animations at all, otherwise 0 would mean nothing.
// Reduced motion is turned on before loading, not mid trip: mid trip the app
// also pauses playback, which freezes animations and would hide a missing
// reduced motion stylesheet.
test('animations jump straight to their end state', async ({ page }) => {
  await startTrip(page);
  expect(await unfinishedAnimations(page)).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expectStation(page, 1);

  await expect.poll(() => unfinishedAnimations(page)).toBe(0);
});
