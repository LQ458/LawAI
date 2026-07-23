import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import ChatComponent from "@/components/ChatComponent";

jest.mock("@/components/DynamicMarkdown", () => ({
  __esModule: true,
  default: function MockDynamicMarkdown({
    content,
    onLoad,
  }: {
    content: string;
    onLoad?: () => void;
  }) {
    useEffect(() => onLoad?.(), [onLoad]);
    return <div>{content}</div>;
  },
}));

jest.mock("primereact/avatar", () => ({
  Avatar: () => <div data-testid="avatar" />,
}));

jest.mock("primereact/progressspinner", () => ({
  ProgressSpinner: () => <div>loading</div>,
}));

jest.mock("primereact/button", () => ({
  Button: ({
    label,
    onClick,
    disabled,
  }: {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));

jest.mock("react-copy-to-clipboard", () => ({
  CopyToClipboard: ({ children }: { children: React.ReactNode }) => children,
}));

describe("ChatComponent", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "grounded_rag",
        grounded: true,
        answer: "检索回答 [DOC:public-1]",
        sources: [
          {
            id: "public-1",
            title: "公开资料",
            source: "CAIL2018",
          },
        ],
      }),
    }) as jest.Mock;
  });

  it("renders ordinary chat content", () => {
    render(<ChatComponent role="user" message="Hello" />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("runs grounded retrieval separately without sending a client userId", async () => {
    render(
      <ChatComponent
        role="assistant"
        message="普通聊天回复"
        retrievalQuery="劳动争议"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "单独检索依据" }));

    await waitFor(() =>
      expect(screen.getByText("公开资料")).toBeInTheDocument(),
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/rag-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "劳动争议" }),
    });
    expect(
      screen.getByText(/上方普通聊天回复未经该次 retrieval/),
    ).toBeInTheDocument();
  });
});
