/** @jest-environment node */

import { NextRequest } from "next/server";
import DBconnect from "@/lib/mongodb";
import { UserActivity } from "@/models/userActivity";
import { getServerIdentity, hasAdminAccess } from "@/lib/serverAuth";
import { GET, POST } from "@/app/api/admin/activity/route";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/serverAuth", () => ({
  getServerIdentity: jest.fn(),
  hasAdminAccess: jest.fn(),
}));

jest.mock("@/lib/rateLimit", () => ({
  consumeRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/userActivity", () => ({
  UserActivity: {
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
  },
}));

const mockedIdentity = jest.mocked(getServerIdentity);
const mockedAdmin = jest.mocked(hasAdminAccess);
const mockedDb = jest.mocked(DBconnect);
const activity = UserActivity as unknown as {
  countDocuments: jest.Mock;
  distinct: jest.Mock;
  aggregate: jest.Mock;
  create: jest.Mock;
};
const identity = {
  subject: "auth0|admin",
  user: { sub: "auth0|admin" },
};

function getRequest(days = "7") {
  return new NextRequest(`http://localhost/api/admin/activity?days=${days}`);
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin activity authorization and minimization", () => {
  beforeEach(() => {
    mockedIdentity.mockResolvedValue(identity);
    mockedAdmin.mockReturnValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    mockedIdentity.mockResolvedValue(null);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(mockedDb).not.toHaveBeenCalled();
  });

  it("returns 403 to a normal authenticated user", async () => {
    mockedAdmin.mockReturnValue(false);

    const response = await GET(getRequest());

    expect(response.status).toBe(403);
    expect(mockedDb).not.toHaveBeenCalled();
  });

  it("returns only aggregates and never user identifiers", async () => {
    activity.countDocuments.mockResolvedValueOnce(5).mockResolvedValueOnce(3);
    activity.distinct.mockResolvedValue(["auth0|one", "auth0|two"]);
    activity.aggregate
      .mockResolvedValueOnce([{ _id: "chat", count: 3 }])
      .mockResolvedValueOnce([
        {
          _id: "2026-07-23",
          actions: 5,
          queries: 3,
          users: ["auth0|one", "auth0|two"],
        },
      ]);

    const response = await GET(getRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.stats.activeUsers).toBe(2);
    expect(JSON.stringify(payload)).not.toContain("auth0|");
    expect(payload).not.toHaveProperty("topUsers");
    expect(payload).not.toHaveProperty("recentActivity");
  });

  it("rejects metadata containing prompts or personal data", async () => {
    const response = await POST(
      postRequest({
        action: "chat",
        metadata: {
          prompt: "private legal question",
          email: "person@example.invalid",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(activity.create).not.toHaveBeenCalled();
  });

  it("stores only the server subject and allowlisted metadata", async () => {
    activity.create.mockResolvedValue({});

    const response = await POST(
      postRequest({
        action: "view",
        metadata: {
          recordId: "507f1f77bcf86cd799439011",
          duration: 12.34,
          source: "case",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(activity.create).toHaveBeenCalledWith({
      userId: "auth0|admin",
      action: "view",
      timestamp: expect.any(Date),
      metadata: {
        recordId: "507f1f77bcf86cd799439011",
        duration: 12.3,
        source: "case",
      },
    });
  });
});
