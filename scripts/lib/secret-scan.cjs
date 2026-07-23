const rules = [
  {
    name: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    name: "github-token",
    pattern: /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  },
  { name: "openai-style-key", pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: "pinecone-key", pattern: /\bpcsk_[A-Za-z0-9_-]{24,}\b/ },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "credentialed-mongodb-uri",
    pattern: /mongodb(?:\+srv)?:\/\/[^:@/\s]+:[^@/\s]+@/i,
  },
];

const sensitiveAssignment =
  /\b(AUTH0_CLIENT_SECRET|AUTH0_SECRET|AUTH0_FGA_CLIENT_SECRET|DEEPSEEK_API_KEY|PINECONE_API_KEY|MONGODB_URL)\s*=\s*([^\s#]+)/g;
const placeholderCredentialPart =
  /^(?:(?:your|example|placeholder|replace[-_.]?me|sample|demo|test|dummy|fake|redacted)[-_.]?)?(?:(?:mongo(?:db)?|db)[-_.]?)?(?:user(?:name)?|login|account|pass(?:word)?|credential)(?:[-_.]?(?:here|value|\d+))*$/i;
const placeholderMarkers = new Set([
  "change",
  "changeme",
  "ci",
  "demo",
  "dummy",
  "example",
  "fake",
  "placeholder",
  "redacted",
  "replace",
  "replaceme",
  "sample",
  "test",
  "testing",
  "your",
]);
const placeholderVocabulary = new Set([
  ...placeholderMarkers,
  "api",
  "auth0",
  "base64",
  "char",
  "character",
  "characters",
  "chars",
  "client",
  "credential",
  "credentials",
  "db",
  "deepseek",
  "dev",
  "development",
  "domain",
  "fga",
  "here",
  "hex",
  "id",
  "issuer",
  "key",
  "local",
  "login",
  "me",
  "mongo",
  "mongodb",
  "pass",
  "password",
  "pinecone",
  "random",
  "secret",
  "string",
  "token",
  "user",
  "username",
  "value",
]);
const placeholderSubjects = new Set([
  "credential",
  "credentials",
  "domain",
  "id",
  "issuer",
  "key",
  "login",
  "pass",
  "password",
  "secret",
  "token",
  "user",
  "username",
  "value",
]);

function normalizePlaceholderValue(value) {
  const trimmed = value.trim().replace(/[;,]$/, "");
  const unquoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
      ? trimmed.slice(1, -1)
      : trimmed;

  try {
    return decodeURIComponent(unquoted);
  } catch {
    return unquoted;
  }
}

function isPlaceholderTokenSequence(value) {
  const tokens = value
    .toLowerCase()
    .split(/[-_.]+/)
    .filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.some((token) => placeholderMarkers.has(token)) &&
    tokens.every(
      (token) => placeholderVocabulary.has(token) || /^\d+$/.test(token),
    )
  );
}

function isStructuredPlaceholderName(value) {
  const tokens = value
    .toLowerCase()
    .split(/[-_.]+/)
    .filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.some(
      (token) =>
        placeholderMarkers.has(token) || placeholderSubjects.has(token),
    ) &&
    tokens.every(
      (token) => placeholderVocabulary.has(token) || /^\d+$/.test(token),
    )
  );
}

function isPlaceholderValue(value) {
  const normalized = normalizePlaceholderValue(value);
  if (
    normalized === "" ||
    normalized === "..." ||
    /^[x*•_-]{4,}$/i.test(normalized) ||
    /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(normalized)
  ) {
    return true;
  }

  const angleMatch = normalized.match(/^<([^<>]+)>$/);
  if (
    angleMatch &&
    (/^[A-Z_][A-Z0-9_]*$/.test(angleMatch[1]) ||
      isStructuredPlaceholderName(angleMatch[1]))
  ) {
    return true;
  }

  const bracketMatch = normalized.match(/^\[([^\[\]]+)\]$/);
  if (bracketMatch && isPlaceholderTokenSequence(bracketMatch[1])) {
    return true;
  }

  return isPlaceholderTokenSequence(normalized);
}

function isPlaceholderMongoUri(value) {
  const match = value.match(/^mongodb(?:\+srv)?:\/\/([^:@/\s]+):([^@/\s]+)@/i);
  if (!match) {
    return false;
  }

  const username = normalizePlaceholderValue(match[1]);
  const password = normalizePlaceholderValue(match[2]);
  return (
    (placeholderCredentialPart.test(username) ||
      isPlaceholderValue(username)) &&
    (placeholderCredentialPart.test(password) || isPlaceholderValue(password))
  );
}

function isNonCredentialedMongoUri(value) {
  return /^mongodb(?:\+srv)?:\/\/[^:@/?#\s]+(?::\d+)?(?:\/[A-Za-z0-9_.-]*)?\/?$/i.test(
    normalizePlaceholderValue(value),
  );
}

function isEnvironmentReference(value) {
  const normalized = normalizePlaceholderValue(value);
  return /^(?:process\.env(?:\.[A-Za-z_][A-Za-z0-9_]*|\[(?:"[A-Za-z_][A-Za-z0-9_]*"|'[A-Za-z_][A-Za-z0-9_]*')\])|env\.[A-Za-z_][A-Za-z0-9_]*)$/.test(
    normalized,
  );
}

function scanText(path, text, scope, findings) {
  for (const rule of rules) {
    const flags = rule.pattern.flags.includes("g")
      ? rule.pattern.flags
      : `${rule.pattern.flags}g`;
    const pattern = new RegExp(rule.pattern.source, flags);

    for (const match of text.matchAll(pattern)) {
      if (
        rule.name === "credentialed-mongodb-uri" &&
        isPlaceholderMongoUri(match[0])
      ) {
        continue;
      }
      findings.push({ path, rule: rule.name, scope });
      break;
    }
  }

  for (const match of text.matchAll(sensitiveAssignment)) {
    const variable = match[1];
    const value = match[2].replace(/[;,]$/, "").replace(/^["']|["']$/g, "");
    const safeMongoExample =
      variable === "MONGODB_URL" &&
      (isPlaceholderMongoUri(value) || isNonCredentialedMongoUri(value));
    if (
      value &&
      !isPlaceholderValue(value) &&
      !safeMongoExample &&
      !isEnvironmentReference(value)
    ) {
      findings.push({ path, rule: "sensitive-env-assignment", scope });
      break;
    }
  }
}

module.exports = {
  isEnvironmentReference,
  isNonCredentialedMongoUri,
  isPlaceholderMongoUri,
  isPlaceholderValue,
  scanText,
};
