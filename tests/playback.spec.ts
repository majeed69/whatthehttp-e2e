import { test, expect } from './fixtures';
import { startTrip, expectStation, stationButton } from './helpers';

// Station 1 lasts 7 seconds at 1x (the duration in the app's STATIONS list).
// The clock is frozen by startTrip, so time only moves inside runFor().

test('autoplay moves on after the station duration', async ({ page }) => {
  await startTrip(page);

  await page.clock.runFor(6_999);
  await expectStation(page, 1);
  await page.clock.runFor(1);
  await expectStation(page, 2);
});

test('pause stops autoplay and play resumes where it left off', async ({ page }) => {
  await startTrip(page);
  await page.clock.runFor(3_000);

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.runFor(60_000);
  await expectStation(page, 1);

  // 3 of the 7 seconds were used before the pause, so 4 are left.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.clock.runFor(3_999);
  await expectStation(page, 1);
  await page.clock.runFor(1);
  await expectStation(page, 2);
});

test('2x speed halves the time per station', async ({ page }) => {
  await startTrip(page);

  await page.getByRole('button', { name: 'Speed: 1x. Switch to 2x' }).click();
  await expect(page.getByRole('button', { name: 'Speed: 2x. Switch to 1x' })).toHaveText('2x');

  await page.clock.runFor(3_499);
  await expectStation(page, 1);
  await page.clock.runFor(1);
  await expectStation(page, 2);
});

test('next and previous move one station and are disabled at the ends', async ({ page }) => {
  await startTrip(page);
  const prev = page.getByRole('button', { name: 'Previous station' });
  const next = page.getByRole('button', { name: 'Next station' });

  await expect(prev).toBeDisabled();
  await next.click();
  await expectStation(page, 2);
  await expect(prev).toBeEnabled();
  await prev.click();
  await expectStation(page, 1);

  await page.keyboard.press('End');
  await expect(next).toBeDisabled();
});

test('clicking a station jumps straight to it', async ({ page }) => {
  await startTrip(page);

  await stationButton(page, 5).click();
  await expectStation(page, 5);
});

test('replay goes back to station 1 and starts playing', async ({ page }) => {
  await startTrip(page);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await stationButton(page, 5).click();

  await page.getByRole('button', { name: 'Replay from the start' }).click();

  await expectStation(page, 1);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.clock.runFor(7_000);
  await expectStation(page, 2);
});

test('autoplay stops at the last station and play starts over', async ({ page }) => {
  await startTrip(page);

  await page.keyboard.press('End');
  await expectStation(page, 8);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectStation(page, 1);
});
