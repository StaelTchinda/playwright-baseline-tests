import { Page, Response } from "@playwright/test";

export interface CheckArgs {
  page: Page;
}

export interface CheckResponseArgs extends CheckArgs {
  response: Response;
}
