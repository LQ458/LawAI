/** @jest-environment node */

import { NextRequest } from "next/server";
import Chat from "@/models/chat";
import DBconnect from "@/lib/mongodb";
import { getServerIdentity } from "@/lib/serverAuth";
import { POST as getChats } from "@/app/api/getChats/route";
import { POST as deleteChat } from "@/app/api/deleteChat/route";
import { POST as updateChatTitle } from "@/app/api/updateChatTitle/route";
import { POST as fetchAi } from "@/app/api/fetchAi/route";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/serverAuth", () => ({
  getServerIdentity: jest.fn(),
}));

jest.mock("@/lib/rateLimit", () => ({
  consumeRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/chat", () => {
  const Model = jest.fn();
  Object.assign(Model, {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  });
  return { __esModule: true, default: Model };
});

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

const mockedIdentity = jest.mocked(getServerIdentity);
const mockedDb = jest.mocked(DBconnect);
const chatModel = Chat as unknown as {
  find: jest.Mock;
  findOne: jest.Mock;
  findOneAndDelete: jest.Mock;
  findOneAndUpdate: jest.Mock;
  updateOne: jest.Mock;
};

const aliceIdentity = {
  subject: "auth0|alice",
  user: { sub: "auth0|alice" },
};
const chatId = "507f1f77bcf86cd799439011";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("authenticated chat ownership", () => {
  beforeEach(() => {
    mockedIdentity.mockResolvedValue(aliceIdentity);
    process.env.DEEPSEEK_API_KEY = "test-placeholder";
  });

  afterAll(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("requires an authenticated session", async () => {
    mockedIdentity.mockResolvedValue(null);

    const response = await getChats(request({ userId: "auth0|bob" }));

    expect(response.status).toBe(401);
    expect(mockedDb).not.toHaveBeenCalled();
  });

  it("ignores a forged userId when listing chats", async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ lean });
    const select = jest.fn().mockReturnValue({ sort });
    chatModel.find.mockReturnValue({ select });

    const response = await getChats(request({ userId: "auth0|bob" }));

    expect(response.status).toBe(200);
    expect(chatModel.find).toHaveBeenCalledWith({ userId: "auth0|alice" });
    expect(select).toHaveBeenCalledWith("_id title time messages");
  });

  it("cannot delete another user's chat", async () => {
    chatModel.findOneAndDelete.mockResolvedValue(null);

    const response = await deleteChat(request({ chatId, userId: "auth0|bob" }));

    expect(response.status).toBe(404);
    expect(chatModel.findOneAndDelete).toHaveBeenCalledWith({
      _id: chatId,
      userId: "auth0|alice",
    });
  });

  it("cannot update another user's chat title", async () => {
    chatModel.findOneAndUpdate.mockResolvedValue(null);

    const response = await updateChatTitle(
      request({
        chatId,
        userId: "auth0|bob",
        newTitle: "forged update",
      }),
    );

    expect(response.status).toBe(404);
    expect(chatModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: chatId, userId: "auth0|alice" },
      { title: "forged update" },
      { new: true },
    );
  });

  it("does not return the Auth0 subject after a title update", async () => {
    chatModel.findOneAndUpdate.mockResolvedValue({
      _id: chatId,
      title: "new title",
      userId: "auth0|alice",
    });

    const response = await updateChatTitle(
      request({ chatId, newTitle: "new title" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      chat: { _id: chatId, title: "new title" },
    });
    expect(JSON.stringify(body)).not.toContain("auth0|alice");
  });

  it("does not append to a chat that the current user does not own", async () => {
    chatModel.findOne.mockResolvedValue(null);

    const response = await fetchAi(
      request({
        chatId,
        userId: "auth0|bob",
        message: "test message",
      }),
    );

    expect(response.status).toBe(404);
    expect(chatModel.findOne).toHaveBeenCalledWith({
      _id: chatId,
      userId: "auth0|alice",
    });
    expect(chatModel.updateOne).not.toHaveBeenCalled();
  });

  it("rejects overlong chat input before database or model access", async () => {
    const response = await fetchAi(
      request({ chatId: "", message: "x".repeat(4_001) }),
    );

    expect(response.status).toBe(400);
    expect(chatModel.findOne).not.toHaveBeenCalled();
  });
});
