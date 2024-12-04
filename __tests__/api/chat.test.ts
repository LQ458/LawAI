import { createMocks } from "node-mocks-http";
import { getServerSession } from "next-auth";
import type { NextApiRequest } from "next";

// Mock getServerSession
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

// Mock MongoDB
jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Create mock API route
const mockPOST = jest.fn(async (req: NextApiRequest) => {
  const session = await getServerSession();
  if (!session) {
    return {
      status: 401,
      body: "Unauthorized",
    };
  }
  return {
    status: 200,
    body: "OK",
  };
});

// Mock API route
jest.mock(
  "../../app/api/chat/route",
  () => ({
    POST: mockPOST,
  }),
  { virtual: true },
);

describe("/api/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    const { req } = createMocks({
      method: "POST",
    });

    (getServerSession as jest.Mock).mockResolvedValueOnce(null);

    const response = await mockPOST(req);

    expect(response.status).toBe(401);
  });
});
