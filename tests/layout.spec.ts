import { test, expect } from './fixtures';
import { startTrip, expectStation, stationButton, STATIONS } from './helpers';
import type { Locator, Page } from '@playwright/test';

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 812 };

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };

// getBoundingClientRect() for every match, the same call the app uses to draw
// the track. Its numbers are relative to the viewport, so the scroll offset is
// added: on mobile the app smooth-scrolls to the active station, and page
// coordinates stay the same while that happens.
const rects = (locator: Locator): Promise<Rect[]> =>
  locator.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
    }),
  );

const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// The dots and track segments are decorative (no role or name), so they need
// CSS selectors. The station buttons around the dots are found by role.
const stationButtons = (page: Page) => page.getByRole('list', { name: 'Stations on the trip' }).getByRole('button');
const dots = (page: Page) => page.locator('.station-dot');
const segments = (page: Page) => page.locator('.seg');
// On mobile the app moves the details panel (a named region) into this item.
const stationItem = (page: Page, n: number) => page.getByRole('listitem').filter({ has: stationButton(page, n) });

// Half a pixel is enough slack for sub-pixel rounding, and far less than any
// real layout bug would move things.
const near = (actual: number, expected: number, what: string) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThan(0.5);

async function expectHorizontalTrack(page: Page) {
  // toPass retries the whole block, because the app redraws the track from a
  // ResizeObserver callback and a check could land just before it.
  await expect(async () => {
    const stations = (await rects(stationButtons(page))).map(centre);
    const dotCentres = (await rects(dots(page))).map(centre);
    const segs = await rects(segments(page));
    expect(segs).toHaveLength(STATIONS.length - 1);

    for (let i = 1; i < stations.length; i++) {
      near(stations[i].y, stations[0].y, `station ${i + 1} is on the same row`);
      expect(stations[i].x, `station ${i + 1} is right of station ${i}`).toBeGreaterThan(stations[i - 1].x);
    }
    for (const [i, seg] of segs.entries()) {
      expect(seg.width, `segment ${i + 1} is wider than tall`).toBeGreaterThan(seg.height);
      near(seg.x, dotCentres[i].x, `segment ${i + 1} starts at dot ${i + 1}`);
      near(seg.x + seg.width, dotCentres[i + 1].x, `segment ${i + 1} ends at dot ${i + 2}`);
      near(centre(seg).y, dotCentres[i].y, `segment ${i + 1} runs through the dots`);
    }
  }).toPass();
}

async function expectVerticalTrack(page: Page) {
  await expect(async () => {
    const stations = (await rects(stationButtons(page))).map(centre);
    const dotCentres = (await rects(dots(page))).map(centre);
    const segs = await rects(segments(page));
    expect(segs).toHaveLength(STATIONS.length - 1);

    for (let i = 1; i < stations.length; i++) {
      near(stations[i].x, stations[0].x, `station ${i + 1} is in the same column`);
      expect(stations[i].y, `station ${i + 1} is below station ${i}`).toBeGreaterThan(stations[i - 1].y);
    }
    for (const [i, seg] of segs.entries()) {
      expect(seg.height, `segment ${i + 1} is taller than wide`).toBeGreaterThan(seg.width);
      near(seg.y, dotCentres[i].y, `segment ${i + 1} starts at dot ${i + 1}`);
      near(seg.y + seg.height, dotCentres[i + 1].y, `segment ${i + 1} ends at dot ${i + 2}`);
      near(centre(seg).x, dotCentres[i].x, `segment ${i + 1} runs through the dots`);
    }
  }).toPass();
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });

  test('the track runs horizontally through the stations', async ({ page }) => {
    await startTrip(page);
    await expectHorizontalTrack(page);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: MOBILE });

  test('the track runs vertically through the stations', { tag: '@smoke' }, async ({ page }) => {
    await startTrip(page);
    await expectVerticalTrack(page);
  });

  test('the details panel sits inside the active station', async ({ page }) => {
    await startTrip(page);

    await expect(stationItem(page, 1).getByRole('region', { name: STATIONS[0] })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expectStation(page, 2);
    await expect(stationItem(page, 2).getByRole('region', { name: STATIONS[1] })).toBeVisible();
    await expect(stationItem(page, 1).getByRole('region')).toHaveCount(0);
    // The panel pushed station 2's neighbours apart, so the track must stretch.
    await expectVerticalTrack(page);
  });
});

const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// A real site with a 58 character label. Browsers only wrap text at spaces
// and hyphens, so a long unbroken name is the worst case for a narrow screen.
const LONG_HOST = 'llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch.co.uk';

// Engineer mode is checked because it adds wide tables and code blocks.
// Two of these are known site bugs, found while writing this suite. test.fail
// keeps the suite green and flags each one as soon as the site is fixed.
const narrowScreens = [
  { width: 375, site: 'example.com' },
  // Below 334px the header doesn't fit and the theme button sticks out 14px
  // at 320px. With the header hidden, nothing else overflows at 320px.
  { width: 320, site: 'example.com', knownBug: 'header is wider than a 320px screen' },
  // The panel text has the name in plain prose, which has no overflow-wrap.
  { width: 375, site: LONG_HOST, knownBug: 'long site names in the panel text never wrap' },
];

for (const { width, site, knownBug } of narrowScreens) {
  test(`nothing overflows sideways at ${width}px with ${site}`, async ({ page }) => {
    test.fail(Boolean(knownBug), knownBug);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./');
    await expect.poll(() => sidewaysOverflow(page), 'start page').toBe(0);

    await startTrip(page, site);
    await page.getByRole('button', { name: 'Engineer' }).click();
    for (let n = 1; n <= STATIONS.length; n++) {
      if (n > 1) await page.keyboard.press('ArrowRight');
      await expectStation(page, n);
      await expect.poll(() => sidewaysOverflow(page), `station ${n}`).toBe(0);
    }
  });
}

// Two things react to a resize: a ResizeObserver on the map redraws the
// track, and a listener for the mobile breakpoint moves the details panel.
// A resize that stays on desktop only triggers the observer, so both kinds
// of resize are checked.
test('the layout follows the window when it is resized', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await startTrip(page);
  await expectHorizontalTrack(page);

  await page.setViewportSize({ width: 900, height: 800 });
  await expectHorizontalTrack(page);

  await page.setViewportSize(MOBILE);
  await expectVerticalTrack(page);
  await expect(stationItem(page, 1).getByRole('region', { name: STATIONS[0] })).toBeVisible();

  await page.setViewportSize(DESKTOP);
  await expectHorizontalTrack(page);
  await expect(stationItem(page, 1).getByRole('region')).toHaveCount(0);
});
