import { expect, type Page } from '@playwright/test';

export const STATIONS = [
  'You hit Enter',
  'Checking the memory',
  'DNS lookup',
  'Knock knock (TCP)',
  'Secret handshake (TLS)',
  'The ask (HTTP)',
  'The page appears',
  'You have arrived',
];

const START = new Date('2026-01-01T09:00:00Z');

// Freezes the page clock, so autoplay only moves when a test calls
// page.clock.runFor(). Without this, autoplay would change the station after
// 7 real seconds and make slow runs flaky. Call it before page.goto().
export async function freezeClock(page: Page) {
  await page.clock.install({ time: START });
  await page.clock.pauseAt(START.getTime() + 1000);
}

export async function startTrip(page: Page, site = 'example.com') {
  await freezeClock(page);
  await page.goto(`./?site=${site}`);
  await expectStation(page, 1);
}

export const stationButton = (page: Page, n: number) =>
  page.getByRole('button', { name: `Station ${n}: ${STATIONS[n - 1]}` });

export async function expectStation(page: Page, n: number) {
  await expect(stationButton(page, n)).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(STATIONS[n - 1]);
}
