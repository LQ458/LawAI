import { render, screen, act } from "@testing-library/react";
import ChatComponent from "@/components/ChatComponent";
import { useSession } from "next-auth/react";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock PrimeReact components
jest.mock("primereact/avatar", () => ({
  Avatar: () => <div data-testid="avatar" />,
}));

describe("ChatComponent", () => {
  const mockSession = {
    data: {
      user: {
        name: "Test User",
      },
    },
    status: "authenticated",
  };

  beforeEach(() => {
    (useSession as jest.Mock).mockReturnValue(mockSession);
  });

  it("renders message content", () => {
    render(<ChatComponent role="user" message="Hello" />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("displays loading state when pending", async () => {
    await act(async () => {
      render(<ChatComponent role="assistant" message="" isTemporary={true} />);
    });

    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });
});
