import { defineConfig, devices } from '@playwright/test';

// No BASE_URL: serve site/ locally and run everything with mocked network.
// BASE_URL set: run only the @smoke tests against that URL.
const liveUrl = process.env.BASE_URL;

// Tests navigate with relative paths like './?site=x'. Without the trailing
// slash, './' on the live URL would resolve to majeed69.github.io/ and lose
// the /whatthehttp/ part.
const baseURL = liveUrl ? liveUrl.replace(/\/?$/, '/') : 'http://127.0.0.1:8000/';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  grep: liveUrl ? /@smoke/ : undefined,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: liveUrl
    ? undefined
    : {
        command: 'python3 -m http.server 8000 --bind 127.0.0.1 --directory site',
        url: 'http://127.0.0.1:8000/',
        reuseExistingServer: !process.env.CI,
        // python logs every request to stderr, which floods the test output
        stderr: 'ignore',
      },
});
