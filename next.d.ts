import { NextRequest as OriginalNextRequest } from "next/server";

declare module "next/server" {
  interface NextRequest extends OriginalNextRequest {
    ip?: string;
  }
}
