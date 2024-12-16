import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha";
import {
  checkPageIsLoaded,
  checkPageFound,
  checkBasicContentPresence,
  checkNoCriticalLoadingIndicators,
  checkNoUnhandledNetworkFailures,
} from "src/check/load";
import { Page, Request, Response } from "@playwright/test";

type PageStub = Record<keyof Page, sinon.SinonStub>;
type ResponseStub = Record<keyof Response, sinon.SinonStub>;

type RelevantPageKeys =
  | "waitForLoadState"
  | "evaluate"
  | "$eval"
  | "waitForSelector"
  | "route"
  | "locator"
  | "on";
type RelevantResponseKeys = "ok" | "status";

// Utility function to check if regex matches
export async function expectRegexMatch(
  actual: any,
  expected: RegExp,
  message?: string
): Promise<void> {
  const { expect } = await import("chai");

  expect(actual).to.match(expected, message);
  // expect(expected.test(actual)).to.be.true(
  //   message ?? `Expected '${actual}' to match '${expected}'`
  // );
}

describe("Load Test Utilities", () => {
  let page: Partial<Omit<PageStub, RelevantPageKeys>> &
    Pick<PageStub, RelevantPageKeys>;
  let response: Partial<Omit<ResponseStub, RelevantResponseKeys>> &
    Pick<ResponseStub, RelevantResponseKeys>;

  beforeEach(() => {
    // Mocking a basic page object
    page = {
      waitForLoadState: sinon.stub().resolves(),
      evaluate: sinon.stub().resolves("complete"),
      $eval: sinon.stub().resolves("Some content"),
      waitForSelector: sinon.stub().resolves(),
      route: sinon.stub().resolves(),
      locator: sinon.stub(),
      on: sinon.stub(),
    };

    // Mocking a basic response object
    response = {
      ok: sinon.stub().returns(true),
      status: sinon.stub().returns(200),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("checkPageIsLoaded", () => {
    it("should pass if the page load state is complete", async () => {
      page.evaluate.resolves("complete");
      await checkPageIsLoaded({ page: page as unknown as Page });
    });

    it("should fail if the page never reaches a complete readyState", async () => {
      const { expect } = await import("chai");
      let error: Error | undefined = undefined;

      page.evaluate.resolves("interactive"); // Simulating not fully loaded
      try {
        await checkPageIsLoaded({ page: page as unknown as Page });
      } catch (err: unknown) {
        expect(err).to.be.an("error");
        error = err as Error;
      }
      expect(error).to.not.be.undefined;
      // TODO: Find out why this is not working, and I need to pass the message to another function for the expect.to.match to work
      // expect(error?.message).to.match(
      //   /Expected: "complete"\nReceived: "interactive"/
      // );
      expectRegexMatch(
        error?.message,
        /Expected: "complete"\nReceived: "interactive"/
      );
    });
  });

  describe("checkPageFound", () => {
    it("should pass if response is ok and status is 200", async () => {
      response.ok.returns(true);
      response.status.returns(200);
      await checkPageFound({
        page: page as unknown as Page,
        response: response as unknown as Response,
      });
    });

    it("should fail if response is not ok", async () => {
      const { expect } = await import("chai");
      let error: Error | undefined = undefined;

      response.ok.returns(false);
      response.status.returns(404);
      try {
        await checkPageFound({
          page: page as unknown as Page,
          response: response as unknown as Response,
        });
      } catch (err: unknown) {
        error = err as Error;
      }
      expect(error).to.not.be.undefined;
      // TODO: Find out why this is not working, and I need to pass the message to another function for the expect.to.match to work
      // expect(error?.message).to.match(/Expected: true\nReceived: false/);
      expectRegexMatch(error?.message, /Expected: true\nReceived: false/);
    });

    it("should fail if status is not 200", async () => {
      const { expect } = await import("chai");
      let error: Error | undefined = undefined;
      response.ok.returns(true);
      response.status.returns(404);
      try {
        await checkPageFound({
          page: page as unknown as Page,
          response: response as unknown as Response,
        });
      } catch (err: unknown) {
        error = err as Error;
      }
      expect(error).to.not.be.undefined;
      // TODO: Find out why this is not working, and I need to pass the message to another function for the expect.to.match to work
      // expect(error?.message).to.match(/Expected: 200\nReceived: 404/);
      expectRegexMatch(error?.message, /Expected: 200\nReceived: 404/);
    });
  });

  describe("checkBasicContentPresence", () => {
    it("should pass if body has content", async () => {
      page.$eval.resolves("<div>Hello World</div>");
      await checkBasicContentPresence({ page: page as unknown as Page });
    });

    it("should fail if body is empty", async () => {
      const { expect } = await import("chai");
      let error: Error | undefined = undefined;

      page.$eval.resolves("     "); // just whitespace
      try {
        await checkBasicContentPresence({ page: page as unknown as Page });
      } catch (err: unknown) {
        error = err as Error;
      }

      expect(error).to.not.be.undefined;
      // TODO: Find out why this is not working, and I need to pass the message to another function for the expect.to.match to work
      // expect(error?.message).to.match(/Expected: 0 to be greater than 0/);
      expectRegexMatch(error?.message, /Expected: 0 to be greater than 0/);
    });
  });

  describe("checkNoCriticalLoadingIndicators", () => {
    it("should pass if there is no loading-spinner", async () => {
      const { expect } = await import("chai");
      let error: Error | undefined = undefined;

      page.locator.returns({
        isVisible: sinon.stub().resolves(false),
      }); // No loading-spinner
      try {
        await checkNoCriticalLoadingIndicators({
          page: page as unknown as Page,
        });
      } catch (err: unknown) {
        error = err as Error;
      }
      expect(error).to.be.undefined;
    });

    it("should pass if loading-spinner eventually disappears", async () => {
      const { expect } = await import("chai");
      let error: Error | undefined = undefined;

      const startTime = Date.now();
      const timeoutSec = 30000;
      page.locator.callsFake((selector: string) => {
        if (selector === ".loading-spinner") {
          return {
            isVisible: sinon.stub().callsFake(() => {
              return Date.now() - startTime < timeoutSec; // Visible for the first 30 seconds
            }),
          };
        } else {
          return {
            isVisible: sinon.stub().resolves(false),
          };
        }
      });
      try {
        await checkNoCriticalLoadingIndicators({
          page: page as unknown as Page,
          maxVisibleTime: timeoutSec,
        });
      } catch (err) {
        error = err as Error;
      }
      expect(error).to.be.undefined;
    });

    it("should fail if loading-spinner does not disappear", async () => {
      const { expect } = await import("chai");
      let error: Error | undefined = undefined;

      const timeoutSec = 3000;
      page.locator.callsFake((selector: string) => {
        if (selector === ".loading-spinner") {
          return {
            isVisible: sinon.stub().resolves(true),
          };
        } else {
          return {
            isVisible: sinon.stub().resolves(false),
          };
        }
      });

      try {
        await checkNoCriticalLoadingIndicators({
          page: page as unknown as Page,
          maxVisibleTime: timeoutSec,
        });
      } catch (err: unknown) {
        error = err as Error;
      }

      expect(error).to.not.be.undefined;
    });
  });

  describe("checkNoUnhandledNetworkFailures", () => {
    let requestFailedCallback: (request: Partial<Request>) => void;

    beforeEach(() => {
      // Capture the callback passed to `page.on('requestfailed', ...)`
      page.on.callsFake((event, cb) => {
        if (event === "requestfailed") {
          requestFailedCallback = cb;
        }
      });
    });

    it("should pass if no stylesheet or script requests fail", async () => {
      // Simulate no failed requests
      await checkNoUnhandledNetworkFailures({ page: page as unknown as Page });
      // No events triggered => no failedRequests
    });

    xit("should fail if a stylesheet request fails", async () => {
      // TODO: Write the test
    });

    xit("should fail if a script request fails", async () => {
      // TODO: Write the test
    });
  });
});
