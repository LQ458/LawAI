/** @jest-environment node */

import { NextRequest } from "next/server";
import { readJsonObject } from "@/lib/request";

function streamedRequest(chunks: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("bounded JSON reader", () => {
  it("rejects a chunked body as soon as its byte budget is exceeded", async () => {
    const result = await readJsonObject(
      streamedRequest(['{"query":"', "1234567890", '"}']),
      12,
    );

    expect(result).toEqual({
      ok: false,
      status: 413,
      error: "payload_too_large",
    });
  });

  it("parses a valid chunked JSON object within budget", async () => {
    const result = await readJsonObject(
      streamedRequest(['{"query":', '"ok"}']),
      32,
    );

    expect(result).toEqual({ ok: true, value: { query: "ok" } });
  });
});
