import { test, expect } from './fixtures';
import { startTrip, expectStation, stationButton } from './helpers';
import { CLOUDFLARE, MOCK_IPV4, MOCK_IPV6, answerDns } from './dns-mock';
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
