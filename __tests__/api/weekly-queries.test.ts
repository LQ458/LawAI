import { GET } from "@/app/api/stats/weekly-queries/route";
import DBconnect from "@/lib/mongodb";
import ChatModel from "@/models/chat";

// Mock dependencies
jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/models/chat");

describe("/api/stats/weekly-queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the count of user queries from the past week", async () => {
    const mockChats = [
      {
        messages: [
          {
            role: "system",
            content: "System message",
            timestamp: new Date(),
          },
          {
            role: "user",
            content: "User query 1",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "Assistant response",
            timestamp: new Date(),
          },
        ],
      },
      {
        messages: [
          {
            role: "user",
            content: "User query 2",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "Assistant response",
            timestamp: new Date(),
          },
        ],
      },
    ];

    (ChatModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(mockChats),
    });

    const response = await GET();
    const data = await response.json();

    expect(DBconnect).toHaveBeenCalled();
    expect(ChatModel.find).toHaveBeenCalled();
    expect(data.count).toBe(2); // Should count 2 user messages
    expect(response.status).toBe(200);
  });

  it("should handle database errors gracefully", async () => {
    (ChatModel.find as jest.Mock).mockImplementation(() => {
      throw new Error("Database error");
    });

    const response = await GET();
    const data = await response.json();

    expect(data.error).toBe("Failed to fetch query statistics");
    expect(response.status).toBe(500);
  });

  it("should only count user messages from the past 7 days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3); // 3 days ago

    const mockChats = [
      {
        messages: [
          {
            role: "user",
            content: "Old query",
            timestamp: oldDate,
          },
          {
            role: "user",
            content: "Recent query",
            timestamp: recentDate,
          },
        ],
      },
    ];

    (ChatModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(mockChats),
    });

    const response = await GET();
    const data = await response.json();

    // Should only count the recent query (within 7 days)
    expect(data.count).toBe(1);
  });

  it("should not count system or assistant messages", async () => {
    const mockChats = [
      {
        messages: [
          {
            role: "system",
            content: "System message",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "Assistant message",
            timestamp: new Date(),
          },
          {
            role: "user",
            content: "User query",
            timestamp: new Date(),
          },
        ],
      },
    ];

    (ChatModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(mockChats),
    });

    const response = await GET();
    const data = await response.json();

    // Should only count the user message
    expect(data.count).toBe(1);
  });

  it("should return 0 when there are no user queries", async () => {
    const mockChats = [
      {
        messages: [
          {
            role: "system",
            content: "System message",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "Assistant message",
            timestamp: new Date(),
          },
        ],
      },
    ];

    (ChatModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(mockChats),
    });

    const response = await GET();
    const data = await response.json();

    expect(data.count).toBe(0);
  });
});
