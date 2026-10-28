import type { Route } from '@playwright/test';

export const CLOUDFLARE = 'https://cloudflare-dns.com/dns-query?**';
export const GOOGLE = 'https://dns.google/resolve?**';

// Without this the browser hides the response from the page (CORS).
export const CORS = { 'access-control-allow-origin': '*' };

// Documentation-only addresses (RFC 5737 and RFC 3849), so a failure message
// makes it obvious the data came from the mock and not a real resolver.
export const MOCK_IPV4 = '192.0.2.10';
export const MOCK_IPV6 = '2001:db8::10';

const TYPE_NUMBER: Record<string, number> = { A: 1, NS: 2, CNAME: 5, AAAA: 28 };

// Replies in the same JSON shape as Cloudflare and Google: one A, one AAAA,
// one NS, and no CNAME, for whatever name was asked.
export async function answerDns(route: Route) {
  const url = new URL(route.request().url());
  const name = url.searchParams.get('name');
  const type = url.searchParams.get('type') ?? '';
  const data: Record<string, string> = { A: MOCK_IPV4, AAAA: MOCK_IPV6, NS: `ns1.${name}.` };
  const answer = data[type] ? [{ name: `${name}.`, type: TYPE_NUMBER[type], TTL: 300, data: data[type] }] : [];

  await route.fulfill({ json: { Status: 0, AD: false, Answer: answer }, headers: CORS });
}

// A real "this name doesn't exist" answer (status 3), with the SOA record a
// resolver puts in the authority section to say which zone gave the answer.
export async function answerNxdomain(route: Route) {
  await route.fulfill({
    json: { Status: 3, AD: false, Authority: [{ name: 'com.', type: 6, TTL: 900, data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1 1800 900 604800 900' }] },
    headers: CORS,
  });
}

// The app times a few no-cors requests to https://<site>/favicon.ico?wthttp=...
export const isTimingRequest = (url: URL) => url.pathname === '/favicon.ico' && url.searchParams.has('wthttp');
