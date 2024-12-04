import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { signIn } from "next-auth/react";
import AuthForm from "@/components/AuthForm";
import { Toast } from "primereact/toast";
import type { ButtonProps } from "primereact/button";
import type { InputTextProps } from "primereact/inputtext";

// Mock PrimeReact components
jest.mock("primereact/button", () => ({
  Button: ({
    onClick,
    children,
    type,
    label,
    className,
    ...props
  }: ButtonProps & { label?: string }) => {
    const {
      loading,
      raised,
      outlined,
      link,
      severity,
      icon,
      iconPos,
      badge,
      badgeClassName,
      tooltip,
      tooltipOptions,
      ...rest
    } = props;
    return (
      <button
        onClick={onClick}
        type={type}
        className={className}
        data-testid={
          type === "submit"
            ? "submit-button"
            : label === "使用Google账号登录"
              ? "google-button"
              : "switch-mode-button"
        }
        {...rest}
      >
        {label || children}
      </button>
    );
  },
}));

jest.mock("primereact/inputtext", () => ({
  InputText: ({
    id,
    value = "",
    onChange,
    type = "text",
    required,
    className,
    ...props
  }: InputTextProps) => {
    const { keyfilter, tooltip, tooltipOptions, ...rest } = props;
    return (
      <input
        id={id}
        value={value as string}
        onChange={onChange}
        type={type}
        required={required}
        className={className}
        {...rest}
      />
    );
  },
}));

// Mock Toast component
const mockShow = jest.fn();
const mockToastRef = {
  current: {
    show: mockShow,
  },
};

jest.mock("primereact/toast", () => ({
  Toast: jest.fn().mockImplementation(() => ({
    show: mockShow,
  })),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

describe("AuthForm", () => {
  const mockToast = {
    current: mockToastRef.current as unknown as Toast,
  };
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders login form by default", () => {
    render(<AuthForm toast={mockToast} onSuccess={mockOnSuccess} />);

    expect(screen.getByLabelText("用户名")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.queryByLabelText("邮箱")).not.toBeInTheDocument();
  });

  it("switches to register form when clicking register button", () => {
    render(<AuthForm toast={mockToast} onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByTestId("switch-mode-button"));

    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
  });

  it("handles successful login", async () => {
    (signIn as jest.Mock).mockResolvedValueOnce({ error: null });

    render(<AuthForm toast={mockToast} onSuccess={mockOnSuccess} />);

    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        username: "testuser",
        password: "password123",
        redirect: false,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it("handles login error", async () => {
    (signIn as jest.Mock).mockResolvedValueOnce({
      error: "Invalid credentials",
    });

    render(<AuthForm toast={mockToast} onSuccess={mockOnSuccess} />);

    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(screen.getByTestId("submit-button"));

    await waitFor(
      () => {
        expect(mockShow).toHaveBeenCalledWith({
          severity: "error",
          summary: "错误",
          detail: "用户名或密码错误",
          life: 3000,
        });
      },
      { timeout: 3000 },
    );
  });
});
