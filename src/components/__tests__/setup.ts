/**
 * src/components/__tests__/setup.ts
 *
 * Loaded by vitest before every component test via `setupFiles`.
 * Extends expect with @testing-library/jest-dom matchers.
 * Only runs the extension in jsdom environment.
 */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);
