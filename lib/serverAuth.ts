import "server-only";

import type { NextRequest } from "next/server";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { auth0 } from "@/lib/auth0";
import { isValidSubject, toFgaUserObject } from "@/lib/fgaIdentity";

const DEFAULT_ADMIN_PERMISSION = "read:admin_activity";
const DEFAULT_ADMIN_ROLE = "admin";

export interface ServerIdentity {
  subject: string;
  user: SessionData["user"];
}

export async function getServerIdentity(
  request?: NextRequest,
): Promise<ServerIdentity | null> {
  const session = request
    ? await auth0.getSession(request)
    : await auth0.getSession();

  if (!session || !isValidSubject(session.user?.sub)) {
    return null;
  }

  return {
    subject: session.user.sub,
    user: session.user,
  };
}

function stringArrayClaim(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function configuredAllowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_AUTH0_SUBJECTS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function hasAdminAccess(identity: ServerIdentity): boolean {
  if (configuredAllowlist().has(identity.subject)) {
    return true;
  }

  const permissionClaim = process.env.AUTH0_PERMISSIONS_CLAIM || "permissions";
  const roleClaim = process.env.AUTH0_ROLES_CLAIM || "roles";
  const requiredPermission =
    process.env.AUTH0_ADMIN_PERMISSION || DEFAULT_ADMIN_PERMISSION;
  const requiredRole = process.env.AUTH0_ADMIN_ROLE || DEFAULT_ADMIN_ROLE;

  const permissions = stringArrayClaim(identity.user[permissionClaim]);
  const roles = stringArrayClaim(identity.user[roleClaim]);

  return (
    permissions.includes(requiredPermission) || roles.includes(requiredRole)
  );
}

export { toFgaUserObject };
