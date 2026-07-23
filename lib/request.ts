import type { NextRequest } from "next/server";

export type JsonBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | {
      ok: false;
      status: 400 | 413 | 415;
      error: "invalid_json" | "payload_too_large" | "unsupported_media_type";
    };

export async function readJsonObject(
  request: NextRequest,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return {
      ok: false,
      status: 415,
      error: "unsupported_media_type",
    };
  }

  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > maxBytes
  ) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  let raw: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) {
      return { ok: false, status: 400, error: "invalid_json" };
    }
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413, error: "payload_too_large" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: "invalid_json" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

export function cleanBoundedString(
  value: unknown,
  options: { min?: number; max: number },
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  const min = options.min ?? 1;
  if (cleaned.length < min || cleaned.length > options.max) {
    return null;
  }

  return cleaned;
}
