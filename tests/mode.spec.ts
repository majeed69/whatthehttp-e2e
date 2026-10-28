import { test, expect } from './fixtures';
import { startTrip, expectStation } from './helpers';

// Both versions of the text are always in the page. The mode only changes
// which one CSS hides, so toBeVisible/toBeHidden is the right check.
test('Engineer mode swaps the plain text for the technical details', async ({ page }) => {
  await startTrip(page);
  await page.keyboard.press('ArrowRight');
  await expectStation(page, 2);

  const simple = page.getByRole('button', { name: 'Simple' });
  const engineer = page.getByRole('button', { name: 'Engineer' });
  const plainText = page.getByText('Names this browser looked up recently.');
  const engineerText = page.getByText('Even earlier shortcuts');

  await expect(simple).toHaveAttribute('aria-pressed', 'true');
  await expect(plainText).toBeVisible();
  await expect(engineerText).toBeHidden();

  await engineer.click();
  await expect(engineer).toHaveAttribute('aria-pressed', 'true');
  await expect(simple).toHaveAttribute('aria-pressed', 'false');
  await expect(engineerText).toBeVisible();
  await expect(plainText).toBeHidden();
  await expectStation(page, 2);

  await simple.click();
  await expect(simple).toHaveAttribute('aria-pressed', 'true');
  await expect(plainText).toBeVisible();
  await expect(engineerText).toBeHidden();
});
