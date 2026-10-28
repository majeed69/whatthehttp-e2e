import { test, expect } from './fixtures';
import { startTrip, expectStation, freezeClock } from './helpers';

test('arrow keys move one station at a time', { tag: '@smoke' }, async ({ page }) => {
  await startTrip(page);

  await page.keyboard.press('ArrowRight');
  await expectStation(page, 2);
  await page.keyboard.press('ArrowRight');
  await expectStation(page, 3);
  await page.keyboard.press('ArrowLeft');
  await expectStation(page, 2);
});

test('Home and End jump to the first and last station', async ({ page }) => {
  await startTrip(page);

  await page.keyboard.press('End');
  await expectStation(page, 8);
  await page.keyboard.press('Home');
  await expectStation(page, 1);
});

test('arrow keys stop at the first and last station', async ({ page }) => {
  await startTrip(page);

  await page.keyboard.press('ArrowLeft');
  await expectStation(page, 1);

  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await expectStation(page, 8);
});

test('Space pauses and resumes playback', async ({ page }) => {
  await startTrip(page);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

// The app handles Space on keydown for the whole page. This checks a focused
// button doesn't also get "clicked" by the same key press.
test('Space on a focused button only toggles playback', async ({ page }) => {
  await startTrip(page);
  await page.getByRole('button', { name: 'Next station' }).focus();

  await page.keyboard.press('Space');

  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expectStation(page, 1);
});

test('typing a site and pressing Enter starts a trip that arrow keys can drive', async ({ page }) => {
  await freezeClock(page);
  await page.goto('./');
  const input = page.getByLabel('Website address');

  await input.fill('example.com');
  await input.press('Enter');

  await expect(page.getByText('Destination')).toBeVisible();
  await expectStation(page, 1);
  // Shortcuts are ignored while the input has focus, so the app has to move
  // focus away from it for the arrow keys to work straight after Enter.
  await expect(page.getByRole('region', { name: 'You hit Enter' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expectStation(page, 2);
});
