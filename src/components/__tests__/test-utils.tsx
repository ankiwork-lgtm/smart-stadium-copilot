/**
 * src/components/__tests__/test-utils.tsx
 *
 * Shared render helper that wraps the component under test with
 * UserContextProvider, so components that call useUserContext() work.
 */
import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { UserContextProvider } from "../UserContextProvider";
import type { UserContext } from "../../../lib/types";

type WrapperProps = {
  children: React.ReactNode;
  initialContext?: Partial<UserContext>;
};

export function renderWithContext(
  ui: React.ReactElement,
  options?: RenderOptions & { initialContext?: Partial<UserContext> }
) {
  const { initialContext, ...rest } = options ?? {};

  function Wrapper({ children }: WrapperProps) {
    // Pre-seed localStorage so UserContextProvider hydrates with our values
    if (initialContext) {
      const defaults: UserContext = {
        role: "fan",
        language: "en",
        accessibilityNeeds: [],
        currentLocationHint: "",
      };
      localStorage.setItem(
        "stadium-user-context",
        JSON.stringify({ ...defaults, ...initialContext })
      );
    }
    return <UserContextProvider>{children}</UserContextProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}
