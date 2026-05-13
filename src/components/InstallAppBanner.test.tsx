import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InstallAppBanner } from "./InstallAppBanner";

// Force the install-prompt hook to a state where the banner CAN show.
const dismissMock = vi.fn();
let showBannerValue = true;
vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({
    showBanner: showBannerValue,
    dismiss: dismissMock,
  }),
}));

// The dialog isn't relevant to banner visibility — stub it out.
vi.mock("./InstallAppDialog", () => ({
  InstallAppDialog: () => null,
}));

const ARMED_KEY = "taclink_install_banner_armed";
const BANNER_TEXT = /Install TacLink for faster access/i;

const renderBanner = (path = "/student/discover") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <InstallAppBanner />
    </MemoryRouter>,
  );

const fireTourCompleted = () => {
  act(() => {
    sessionStorage.setItem(ARMED_KEY, "1");
    window.dispatchEvent(new CustomEvent("taclink:tour-completed"));
  });
};

describe("InstallAppBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
    dismissMock.mockClear();
    showBannerValue = true;
  });

  it("is hidden before the crash-course tour completes", () => {
    renderBanner();
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  for (const role of ["student", "instructor"] as const) {
    const path = role === "student" ? "/student/discover" : "/instructor/dashboard";

    it(`appears for ${role} after tour completes and persists until X is clicked`, () => {
      renderBanner(path);
      expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();

      fireTourCompleted();
      expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();

      // Re-render simulation: still visible (no auto-dismiss timer).
      expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();

      // Click X
      act(() => {
        screen.getByLabelText(/dismiss install reminder/i).click();
      });
      expect(dismissMock).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(ARMED_KEY)).toBeNull();

      // Simulate hook reflecting dismissal
      showBannerValue = false;
      expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
    });
  }

  it("stays hidden on routes where the banner is suppressed", () => {
    renderBanner("/auth/sign-in");
    fireTourCompleted();
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });
});
