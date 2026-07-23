const MAX_SUBJECT_LENGTH = 255;

function isValidSubject(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SUBJECT_LENGTH &&
    !/\s/.test(value)
  );
}

/**
 * Maps a server-verified Auth0 subject to a stable OpenFGA user object.
 * Callers are responsible for sourcing the subject from the server session.
 */
export function toFgaUserObject(subject: string): string {
  if (!isValidSubject(subject)) {
    throw new Error("Invalid authenticated subject");
  }

  return `user:auth0_${Buffer.from(subject, "utf8").toString("base64url")}`;
}

export { isValidSubject };
