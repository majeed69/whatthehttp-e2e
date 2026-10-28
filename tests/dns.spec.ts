import { test, expect } from './fixtures';
import { startTrip, expectStation, stationButton, freezeClock } from './helpers';
import { CLOUDFLARE, GOOGLE, CORS, MOCK_IPV4, MOCK_IPV6, answerDns, answerNxdomain } from './dns-mock';
import type { Page, Route } from '@playwright/test';

// Every DoH query type the page sends to one resolver, in order.
function queriesTo(page: Page, hostname: string) {
  const types: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname === hostname) types.push(url.searchParams.get('type') ?? '');
  });
  return types;
}

async function openDnsStation(page: Page) {
  await stationButton(page, 3).click();
  await expectStation(page, 3);
}

const ipv4List = (page: Page) => page.getByRole('list', { name: 'IPv4 addresses' });
const ipv6List = (page: Page) => page.getByRole('list', { name: 'IPv6 addresses' });

// Runs in both modes: mocked locally, real Cloudflare or Google when live.
test('the DNS station shows the addresses the resolver sent back', { tag: '@smoke' }, async ({ page }) => {
  await startTrip(page);
  await openDnsStation(page);

  await expect(ipv4List(page).getByRole('listitem').first()).toHaveText(/^\d{1,3}(\.\d{1,3}){3}\b/);
  await expect(page.getByText(/We asked (Cloudflare|Google) over HTTPS/)).toBeVisible();
});

// Everything below only runs locally (no @smoke tag), against mocks.

test('shows the Cloudflare answer and never asks Google', async ({ page }) => {
  const google = queriesTo(page, 'dns.google');
  await startTrip(page);
  await openDnsStation(page);

  await expect(ipv4List(page)).toHaveText(`${MOCK_IPV4} IPv4`);
  await expect(ipv6List(page)).toHaveText(`${MOCK_IPV6} IPv6`);
  await expect(page.getByText('300 seconds (about 5 minutes)')).toBeVisible();
  await expect(page.getByText('We asked Cloudflare over HTTPS')).toBeVisible();
  expect(google).toEqual([]);
});

// Each A, AAAA and CNAME query is held until all three have arrived. If the
// app sent them one after another, the second would never be sent and the
// poll below would time out.
test('asks Cloudflare for A, AAAA and CNAME at the same time', async ({ page }) => {
  const held = new Map<string, Route>();
  await page.route(CLOUDFLARE, async (route) => {
    const type = new URL(route.request().url()).searchParams.get('type') ?? '';
    if (type === 'NS') return answerDns(route);
    held.set(type, route);
  });

  await startTrip(page);
  await expect.poll(() => [...held.keys()].sort()).toEqual(['A', 'AAAA', 'CNAME']);

  for (const route of held.values()) {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('name')).toBe('example.com');
    expect(route.request().headers()['accept']).toBe('application/dns-json');
  }
  for (const route of held.values()) await answerDns(route);

  await openDnsStation(page);
  await expect(ipv4List(page)).toHaveText(`${MOCK_IPV4} IPv4`);
});

test.describe('when Cloudflare fails', () => {
  test.use({ failingHosts: ['cloudflare-dns.com'] });

  const problems = [
    { problem: 'cannot be reached', fail: (route: Route) => route.abort() },
    { problem: 'answers with HTTP 500', fail: (route: Route) => route.fulfill({ status: 500, headers: CORS }) },
    {
      problem: 'sends back something that is not DNS',
      fail: (route: Route) => route.fulfill({ body: '<html>oops</html>', contentType: 'text/html', headers: CORS }),
    },
  ];

  for (const { problem, fail } of problems) {
    test(`Google is used when Cloudflare ${problem}`, async ({ page }) => {
      await page.route(CLOUDFLARE, fail);
      await page.route(GOOGLE, answerDns);
      const google = queriesTo(page, 'dns.google');

      await startTrip(page);
      await openDnsStation(page);

      await expect(ipv4List(page)).toHaveText(`${MOCK_IPV4} IPv4`);
      await expect(page.getByText("Cloudflare didn't answer, so we asked Google instead.")).toBeVisible();
      await expect(page.getByText('We asked Google over HTTPS')).toBeVisible();
      expect(google).toEqual(expect.arrayContaining(['A', 'AAAA', 'CNAME']));
    });
  }

  // The app gives each resolver 7 seconds. The page clock is frozen, so the
  // timeout only fires when the test moves time forward.
  test('Google is used when Cloudflare is too slow', async ({ page }) => {
    await page.route(CLOUDFLARE, () => {}); // never answers
    await page.route(GOOGLE, answerDns);
    const google = queriesTo(page, 'dns.google');

    await startTrip(page);
    await page.clock.runFor(6_999);
    expect(google).toEqual([]);
    await page.clock.runFor(1);
    await expect.poll(() => google).toEqual(expect.arrayContaining(['A', 'AAAA', 'CNAME']));

    await openDnsStation(page);
    await expect(ipv4List(page)).toHaveText(`${MOCK_IPV4} IPv4`);
  });
});

test.describe('when both resolvers fail', () => {
  test.use({ failingHosts: ['cloudflare-dns.com', 'dns.google'] });

  test('the user gets a clear error and can try again', async ({ page }) => {
    await page.route(CLOUDFLARE, (route) => route.fulfill({ status: 500, headers: CORS }));
    await page.route(GOOGLE, (route) => route.abort());

    await startTrip(page);
    await openDnsStation(page);

    await expect(page.getByText('Signal failure')).toBeVisible();
    await expect(page.getByRole('heading', { name: "We couldn't reach a DNS resolver" })).toBeVisible();
    await expect(page.getByText('End of the line')).toBeVisible();
    for (let n = 4; n <= 8; n++) await expect(stationButton(page, n)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next station' })).toBeDisabled();

    // Engineer mode lists why each resolver failed.
    await page.getByRole('button', { name: 'Engineer' }).click();
    await expect(page.getByRole('row', { name: 'Cloudflare answered with HTTP 500' })).toBeVisible();
    await expect(page.getByRole('row', { name: 'Google could not be reached (offline, blocked, or refused)' })).toBeVisible();

    // The rest of the page still works.
    await stationButton(page, 1).click();
    await expectStation(page, 1);
    await openDnsStation(page);

    // Cloudflare comes back (the default mock takes over again).
    await page.unroute(CLOUDFLARE);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expectStation(page, 3);
    await expect(ipv4List(page)).toHaveText(`${MOCK_IPV4} IPv4`);
    await expect(stationButton(page, 4)).toBeEnabled();
  });
});

// NXDOMAIN is a real answer from a working resolver, so asking Google would
// only get the same answer. The app must show it instead of falling back.
test('a "no such domain" answer is shown and not retried on Google', async ({ page }) => {
  await page.route(CLOUDFLARE, answerNxdomain);
  const google = queriesTo(page, 'dns.google');

  await startTrip(page, 'no-such-site-here.com');
  await openDnsStation(page);

  await expect(page.getByRole('heading', { name: "There's no such place as no-such-site-here.com" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fix the spelling' })).toBeVisible();
  expect(google).toEqual([]);
});

test('offline users get their own message and no DNS request is sent', async ({ page, context }) => {
  const cloudflare = queriesTo(page, 'cloudflare-dns.com');
  await freezeClock(page);
  await page.goto('./');

  await context.setOffline(true);
  await page.getByLabel('Website address').fill('example.com');
  await page.getByLabel('Website address').press('Enter');
  await openDnsStation(page);

  await expect(page.getByRole('heading', { name: 'You seem to be offline' })).toBeVisible();
  expect(cloudflare).toEqual([]);
});
