import { render, screen, waitFor } from "@testing-library/react";
import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";

jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("primereact/button", () => ({
  Button: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: (event: React.MouseEvent) => void;
  }) => <button onClick={onClick}>{label}</button>,
}));

const mockedUseAuth = jest.mocked(useAuth);

describe("AuthForm", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      user: null,
    });
  });

  it("renders the Auth0 login and signup actions", () => {
    render(<AuthForm onSuccess={jest.fn()} setInitChat={jest.fn()} />);

    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "注册新账号" }),
    ).toBeInTheDocument();
  });

  it("notifies the parent after Auth0 reports an authenticated session", async () => {
    const onSuccess = jest.fn();
    const setInitChat = jest.fn();
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      error: null,
      user: { sub: "auth0|test" },
    });

    render(<AuthForm onSuccess={onSuccess} setInitChat={setInitChat} />);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(setInitChat).toHaveBeenCalledWith(true);
    });
  });
});
