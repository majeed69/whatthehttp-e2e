import { test as base, expect } from '@playwright/test';
import { CLOUDFLARE, answerDns, isTimingRequest } from './dns-mock';

export const isLive = Boolean(process.env.BASE_URL);

const LOCAL_HOST = '127.0.0.1';

type AutoFixtures = {
  localNetwork: void;
  failOnPageErrors: void;
};

export const test = base.extend<AutoFixtures>({
  // In local mode nothing may leave the machine. The last registered route
  // runs first, so the default mocks below get the first look and the guard
  // only sees requests nobody mocked. A test can still override a default
  // with page.route(), because page routes run before context routes.
  localNetwork: [
    async ({ context }, use) => {
      const leaked: string[] = [];
      if (!isLive) {
        await context.route(
          (url) => url.hostname !== LOCAL_HOST,
          (route) => {
            leaked.push(route.request().url());
            return route.abort();
          },
        );
        await context.route(CLOUDFLARE, answerDns);
        await context.route(isTimingRequest, (route) => route.fulfill({ status: 200 }));
      }
      await use();
      expect(leaked, 'unmocked requests that tried to leave localhost').toEqual([]);
    },
    { auto: true },
  ],

  failOnPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });
      page.on('pageerror', (err) => errors.push(`uncaught: ${err.message}`));

      // Chromium doesn't log every CSP violation to the console, but it
      // always fires this event, so listen for it from the first script.
      await page.exposeFunction('reportCspViolation', (text: string) => errors.push(`csp: ${text}`));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as any).reportCspViolation(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`);
        });
      });

      await use();
      expect(errors, 'console errors, uncaught errors and CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
