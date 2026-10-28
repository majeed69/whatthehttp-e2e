# whatthehttp-e2e

[![tests](https://github.com/majeed69/whatthehttp-e2e/actions/workflows/tests.yml/badge.svg)](https://github.com/majeed69/whatthehttp-e2e/actions/workflows/tests.yml)
[![live smoke](https://github.com/majeed69/whatthehttp-e2e/actions/workflows/live-smoke.yml/badge.svg)](https://github.com/majeed69/whatthehttp-e2e/actions/workflows/live-smoke.yml)

End-to-end tests for [WhatTheHTTP](https://majeed69.github.io/whatthehttp/), written with Playwright. The site lives in its own repo, [majeed69/whatthehttp](https://github.com/majeed69/whatthehttp). This repo only holds the tests.

## What it covers

| File | What it checks |
| --- | --- |
| `smoke.spec.ts` | The page loads and all 8 stations render |
| `keyboard.spec.ts` | Arrow keys, Home, End and Space, and starting a trip from the keyboard |
| `playback.spec.ts` | Autoplay timing, pause and resume, 2x speed, next, previous and replay |
| `focus.spec.ts` | Tab order and a visible focus ring on every control |
| `mode.spec.ts` | Simple and Engineer mode show different content |
| `theme.spec.ts` | Light and dark theme, the saved choice, and the system setting |
| `reduced-motion.spec.ts` | Autoplay stays off and animations end at once with reduced motion |
| `layout.spec.ts` | The track is horizontal on desktop and vertical on mobile, and nothing overflows sideways |
| `dns.spec.ts` | DNS answers, the Google fallback, timeouts, NXDOMAIN, offline and the error screen |

Every test also fails if the page logs a console error, throws, or breaks its Content Security Policy. In local mode a test also fails if any request tries to leave the machine without a mock.

Three tests are marked `test.fail()` because they found real bugs in the site. They will start failing ("unexpectedly passed") once the site is fixed, as a reminder to remove the mark:

- focus is lost when the Next button gets disabled at the last station
- the header is wider than a 320px screen
- long site names in the panel text don't wrap on a phone

## Running it

You need Node 22 and Python 3 (Playwright uses `python3 -m http.server` to serve the site).

```bash
git clone https://github.com/majeed69/whatthehttp-e2e.git
cd whatthehttp-e2e
git clone https://github.com/majeed69/whatthehttp.git site
npm ci
npx playwright install chromium
```

Run the full suite against a local copy of the site:

```bash
npm test
```

Run only the `@smoke` tests against the live site:

```bash
npm run test:live
```

`npm run test:live` just sets `BASE_URL`. To test another copy of the site, set it yourself: `BASE_URL=https://your-copy.example/ npx playwright test`. Open the last HTML report with `npx playwright show-report`.

## Why the DNS tests are mocked

The site looks up real DNS records through Cloudflare, and falls back to Google if Cloudflare can't be reached. In local mode every DNS request is answered by `page.route()` instead:

- The answers are the same on every run. Real resolvers return different IPs depending on where you ask from and when.
- A test doesn't fail because Cloudflare or Google had a bad minute, or because CI runs on a network that blocks DNS over HTTPS.
- The interesting cases can't be triggered on demand with a real resolver: Cloudflare being down, a slow reply, an HTTP 500, NXDOMAIN, or both resolvers failing at once.
- CI doesn't send traffic to third parties on every push.

The real thing is still tested. The live smoke run does a real DNS lookup against the live site once a day.

## How it's put together

- `playwright.config.ts` picks the mode. No `BASE_URL` means local mode with a web server, otherwise only `@smoke` tests run.
- `tests/fixtures.ts` holds the checks that run for every test: the error and CSP guard, the local network guard and the default mocks.
- `tests/dns-mock.ts` builds DNS over HTTPS answers in the same JSON shape Cloudflare and Google use.
- `tests/helpers.ts` starts a trip with the page clock frozen, so autoplay only moves when a test calls `page.clock.runFor()`. No test waits on real time.

To check that the tests can actually fail, I broke the site on purpose while writing them (served a changed `app.js` or `style.css` through `page.route()`) and made sure the right test caught each change. That found a few weak tests, which were fixed before they were committed.
