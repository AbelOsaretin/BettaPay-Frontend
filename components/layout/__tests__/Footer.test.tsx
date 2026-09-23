import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Footer from "../Footer";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// next/image — simplified stub so jsdom doesn't error on <Image>
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// next/link — render a plain <a>
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: React.PropsWithChildren<{ href?: string }>) => <a href={href}>{children}</a>,
}));

// RUM module — stub so analytics never interfere with assertions
jest.mock("@/lib/rum", () => ({
  recordRumEvent: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFooter() {
  return render(<Footer />);
}

// Default fetch mock: succeeds with { success: true }
function mockFetchSuccess() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  } as Response);
}

// Fetch mock that returns an API-level error
function mockFetchApiError(message = "Invalid email.") {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: message }),
  } as Response);
}

// Fetch mock that rejects entirely (network failure)
function mockFetchNetworkError() {
  global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Footer — newsletter signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("renders an email input with a visible <label>", () => {
    renderFooter();
    // getByLabelText throws if no matching label exists — this is the
    // accessibility contract assertion.
    const input = screen.getByLabelText(/email address/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "email");
  });

  it("email input has aria-describedby pointing to help text", () => {
    renderFooter();
    const input = screen.getByLabelText(/email address/i);
    const helpId = input.getAttribute("aria-describedby");
    expect(helpId).toBeTruthy();

    // The element referenced by aria-describedby must exist and contain
    // the help copy.
    const helpEl = document.getElementById(helpId!.split(" ")[0]);
    expect(helpEl).toBeInTheDocument();
    expect(helpEl?.textContent).toMatch(/no spam/i);
  });

  it("has a submit button with accessible text", () => {
    renderFooter();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
  });

  it("includes a honeypot field that is hidden from assistive technology", () => {
    renderFooter();
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot).toBeInTheDocument();
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
  });

  // ── Success flow ───────────────────────────────────────────────────────────

  it("shows success message after a valid submission", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByLabelText(/email address/i), "hello@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/you're subscribed/i);
    });
  });

  it("calls /api/newsletter with the entered email", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByLabelText(/email address/i), "dev@bettapay.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/newsletter",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("dev@bettapay.com"),
        })
      );
    });
  });

  it("clears the email input after a successful submission", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    renderFooter();

    const input = screen.getByLabelText(/email address/i);
    await user.type(input, "user@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      // Success state replaces the form — input is no longer rendered.
      expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    });
  });

  // ── Error flow ─────────────────────────────────────────────────────────────

  it("shows an error alert when the API returns an error", async () => {
    mockFetchApiError("Please enter a valid email address.");
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByLabelText(/email address/i), "bad");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/valid email/i);
    });
  });

  it("shows a generic error on network failure", async () => {
    mockFetchNetworkError();
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByLabelText(/email address/i), "ok@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/network error/i);
    });
  });

  it("links the error message to the input via aria-describedby", async () => {
    mockFetchApiError("Please enter a valid email address.");
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByLabelText(/email address/i), "bad");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      const input = screen.getByLabelText(/email address/i);
      // aria-invalid must be set when there's an error.
      expect(input).toHaveAttribute("aria-invalid", "true");
      // aria-describedby must reference both help text AND the error element.
      const describedBy = input.getAttribute("aria-describedby") ?? "";
      const ids = describedBy.split(" ").filter(Boolean);
      expect(ids.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("clears the error and restores aria-invalid when the user starts typing again", async () => {
    mockFetchApiError("Please enter a valid email address.");
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByLabelText(/email address/i), "bad");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    // Now type in the input — error should clear.
    await user.type(screen.getByLabelText(/email address/i), "x");
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).not.toHaveAttribute("aria-invalid");
    });
  });

  // ── Analytics tracking ─────────────────────────────────────────────────────

  it("calls recordRumEvent after a successful submission", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    renderFooter();

    // Dynamic import inside the component resolves the same mock module.
    const { recordRumEvent } = await import("@/lib/rum");

    await user.type(screen.getByLabelText(/email address/i), "track@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(recordRumEvent).toHaveBeenCalledWith(
        "newsletter_signup",
        1,
        expect.any(String)
      );
    });
  });
});
