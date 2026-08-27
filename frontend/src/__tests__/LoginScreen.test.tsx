import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginScreen from "../components/LoginScreen";

const mockSetStoredAuth = vi.fn();
const mockOnLogin = vi.fn();

vi.mock("../auth", () => ({
  setStoredAuth: (...args: unknown[]) => mockSetStoredAuth(...args),
}));

type FetchMock = ReturnType<typeof vi.fn>;

describe("LoginScreen", () => {
  beforeEach(() => {
    mockSetStoredAuth.mockClear();
    mockOnLogin.mockClear();
    // Default: successful login response.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: "test-token" }),
      text: async () => "",
      headers: { get: () => null },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the login form with password input and unlock button", () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });

  it("disables the submit button while the password is empty", () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    expect(screen.getByRole("button", { name: "Unlock" })).toBeDisabled();
  });

  it("logs in successfully, stores the token, and calls onLogin", async () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(mockOnLogin).toHaveBeenCalled());
    expect(mockSetStoredAuth).toHaveBeenCalledWith("test-token");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the server detail on a wrong password (401) and does not log in", async () => {
    (globalThis.fetch as FetchMock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => JSON.stringify({ detail: "Wrong password" }),
      headers: { get: () => null },
    });
    render(<LoginScreen onLogin={mockOnLogin} />);
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("Wrong password")).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("shows a lockout UI with countdown and dimmed form on 429 (rate limited)", async () => {
    (globalThis.fetch as FetchMock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () => "",
      headers: { get: () => "120" },
    });
    render(<LoginScreen onLogin={mockOnLogin} />);
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText(/2 minutes remaining/i)).toBeInTheDocument();
    // The submit button becomes "Locked out" and is disabled.
    const submit = screen.getByRole("button", { name: "Locked out" });
    expect(submit).toBeDisabled();
    // The password input is disabled while locked out.
    expect(screen.getByPlaceholderText("Password")).toBeDisabled();
    // Password is cleared after a failed attempt.
    expect(screen.getByPlaceholderText("Password")).toHaveValue("");
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("clears the password on a failed login", async () => {
    (globalThis.fetch as FetchMock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => JSON.stringify({ detail: "Wrong password" }),
      headers: { get: () => null },
    });
    render(<LoginScreen onLogin={mockOnLogin} />);
    const input = screen.getByPlaceholderText("Password");
    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await screen.findByText("Wrong password");
    expect(input).toHaveValue("");
  });

  it("toggles password visibility when the eye button is clicked", () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveAttribute("type", "password");
    // The eye toggle is the first button (before the submit button).
    const eye = screen.getAllByRole("button")[0];
    fireEvent.click(eye);
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(eye);
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows an offline message when fetch fails with a TypeError", async () => {
    (globalThis.fetch as FetchMock).mockRejectedValue(new TypeError("NetworkError"));
    render(<LoginScreen onLogin={mockOnLogin} />);
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(
      await screen.findByText("Can't reach the server — check your connection."),
    ).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("shows a generic server error for non-TypeError failures", async () => {
    (globalThis.fetch as FetchMock).mockRejectedValue(new Error("boom"));
    render(<LoginScreen onLogin={mockOnLogin} />);
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("Could not reach server")).toBeInTheDocument();
  });
});
