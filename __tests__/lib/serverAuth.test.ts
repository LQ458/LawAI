/** @jest-environment node */

import { hasAdminAccess, type ServerIdentity } from "@/lib/serverAuth";

jest.mock("@/lib/auth0", () => ({
  auth0: {
    getSession: jest.fn(),
  },
}));

function identity(
  subject: string,
  claims: Record<string, unknown> = {},
): ServerIdentity {
  return {
    subject,
    user: { sub: subject, ...claims },
  };
}

describe("admin claim authorization", () => {
  const keys = [
    "ADMIN_AUTH0_SUBJECTS",
    "AUTH0_PERMISSIONS_CLAIM",
    "AUTH0_ROLES_CLAIM",
    "AUTH0_ADMIN_PERMISSION",
    "AUTH0_ADMIN_ROLE",
  ] as const;

  beforeEach(() => {
    for (const key of keys) delete process.env[key];
  });

  afterAll(() => {
    for (const key of keys) delete process.env[key];
  });

  it("accepts the configured permission", () => {
    expect(
      hasAdminAccess(
        identity("auth0|permission-user", {
          permissions: ["read:admin_activity"],
        }),
      ),
    ).toBe(true);
  });

  it("accepts the configured role claim", () => {
    process.env.AUTH0_ROLES_CLAIM = "https://example.invalid/roles";
    process.env.AUTH0_ADMIN_ROLE = "activity-admin";

    expect(
      hasAdminAccess(
        identity("auth0|role-user", {
          "https://example.invalid/roles": ["activity-admin"],
        }),
      ),
    ).toBe(true);
  });

  it("accepts only an exact subject allowlist match", () => {
    process.env.ADMIN_AUTH0_SUBJECTS =
      "auth0|allowed, auth0|another-placeholder";

    expect(hasAdminAccess(identity("auth0|allowed"))).toBe(true);
    expect(hasAdminAccess(identity("auth0|allow"))).toBe(false);
  });

  it("denies an ordinary authenticated identity", () => {
    expect(
      hasAdminAccess(
        identity("auth0|ordinary", {
          roles: ["member"],
          permissions: ["read:profile"],
        }),
      ),
    ).toBe(false);
  });
});
