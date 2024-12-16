import { expect, Page } from "@playwright/test";
import { CheckArgs, CheckResponseArgs } from "src/interfaces/check";

export async function checkPageIsLoaded({ page }: CheckArgs): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  expect(await page.evaluate(() => document.readyState)).toBe("complete");
}

export async function checkPageFound({
  response,
}: CheckResponseArgs): Promise<void> {
  expect(response.ok(), { message: "Response is not OK" }).toBe(true);
  expect(response.status(), "Response status is 404").not.toBe(404);
  expect(response.status(), "Response status is not 200").toBe(200);
}

export async function checkBasicContentPresence({
  page,
}: CheckArgs): Promise<void> {
  const bodyContent = await page.$eval("body", (body) => body.innerHTML);
  expect(bodyContent.trim().length).toBeGreaterThan(0);
}

export interface CheckTransientVisibilityArgs extends CheckArgs {
  selectors: string[];
  maxVisibleTime?: number;
}

/**
 * Checks the visibility of elements specified by the selectors and ensures they are not visible after a given time.
 *
 * @param {Object} params - The parameters for the function.
 * @param {import('playwright').Page} params.page - The Playwright page object.
 * @param {string[]} params.selectors - An array of CSS selectors for the elements to check.
 * @param {number} [params.maxVisibleTime=0] - The maximum time (in milliseconds) the elements are allowed to be visible.
 * @returns {Promise<void>} A promise that resolves when the check is complete.
 *
 * @throws Will throw an error if any element is still visible after the specified maxVisibleTime.
 */
export async function checkTransientVisibility({
  page,
  selectors,
  maxVisibleTime = 0,
}: CheckTransientVisibilityArgs): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (locator === null || locator === undefined) {
      continue;
    }
    expect(async () => {
      locator.waitFor({ state: "hidden", timeout: maxVisibleTime });
    }, `Element ${selector} is still visible after ${maxVisibleTime}ms`).toPass();
  }
}

export async function checkNoCriticalLoadingIndicators({
  page,
  selectors = DEFAULT_LOADING_SELECTORS,
  maxVisibleTime = 0,
}: Partial<Omit<CheckTransientVisibilityArgs, "page">> &
  Pick<CheckTransientVisibilityArgs, "page">): Promise<void> {
  checkTransientVisibility({ page, selectors, maxVisibleTime });
}

const DEFAULT_SPINNER_SELECTOR: string[] = [
  ".spinner",
  ".loading-spinner",
  ".loading-indicator",
  ".ant-spin",
  ".fa-spinner",
  ".fas.fa-spinner",
  ".v-progress-circular",
  ".el-loading-spinner",
];
// .ant-spin (Ant Design)
// .fa-spinner or .fas.fa-spinner (Font Awesome icon)
// .v-progress-circular (Vuetify)
// .el-loading-spinner (Element UI)
const DEFAULT_PROGRESS_BAR_SELECTOR: string[] = [
  ".progress-bar",
  "[role='progressbar']",
  ".mat-progress-bar",
  ".MuiCircularProgress-root",
];
// .mat-progress-bar (Angular Material)
// .MuiCircularProgress-root (Material UI)
const DEFAULT_LOADING_SELECTORS: string[] = [
  ...DEFAULT_SPINNER_SELECTOR,
  ...DEFAULT_PROGRESS_BAR_SELECTOR,
];

export async function checkNoUnhandledNetworkFailures({
  page,
}: CheckArgs): Promise<void> {
  await page.route("**/*.{css,js}", (route) => route.continue());
  const failedRequests = [];
  page.on("requestfailed", (request) => {
    if (
      request.resourceType() === "stylesheet" ||
      request.resourceType() === "script"
    ) {
      failedRequests.push(request);
    }
  });
  expect(failedRequests.length).toBe(0);
}
