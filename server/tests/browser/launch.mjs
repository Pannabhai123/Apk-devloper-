/**
 * Launches a REAL Chromium headless browser in this sandbox.
 *
 * No browser binary ships with the repo. We use the npm-published
 * @sparticuz/chromium bundle (a Chrome-for-Testing headless shell plus its
 * Amazon Linux 2023 shared libraries) driven by playwright-core. Setting
 * AWS_EXECUTION_ENV before the import makes the bundle extract its bundled
 * libs into /tmp and add them to LD_LIBRARY_PATH.
 *
 * This is genuinely a browser: real layout, real cookies, real Devanagari
 * rendering, real downloads. It is NOT a jsdom/HTTP simulation.
 */
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';

const { default: chromium } = await import('@sparticuz/chromium');
const { chromium: playwright } = await import('playwright-core');

export async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  // Use the bundle's full recommended flag set. Earlier attempts to drop the
  // serverless-only flags produced an unstable (SIGSEGV) headless shell here.
  const args = chromium.args;
  const browser = await playwright.launch({
    executablePath,
    headless: chromium.headless,
    args: [...args, '--no-sandbox', '--disable-dev-shm-usage'],
  });
  return { browser, executablePath };
}
