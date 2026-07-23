import secretScan from "../../scripts/lib/secret-scan.cjs";

const { isEnvironmentReference, isPlaceholderValue, scanText } = secretScan;

function findingsFor(text) {
  const findings = [];
  scanText("fixture", text, "test", findings);
  return findings;
}

describe("secret scan placeholder boundaries", () => {
  it("accepts explicit whole-value placeholders", () => {
    expect(isPlaceholderValue("your_auth0_client_secret")).toBe(true);
    expect(isPlaceholderValue("<AUTH0_CLIENT_SECRET>")).toBe(true);
    expect(isPlaceholderValue("[REDACTED]")).toBe(true);
    expect(isPlaceholderValue("${AUTH0_SECRET}")).toBe(true);
  });

  it("rejects placeholder markers embedded in other values", () => {
    expect(isPlaceholderValue("real-secret-your_placeholder")).toBe(false);
    expect(isPlaceholderValue("prefix<AUTH0_SECRET>suffix")).toBe(false);
    expect(isPlaceholderValue("real-example.invalid-secret")).toBe(false);
  });

  it("rejects arbitrary bracket-wrapped values", () => {
    expect(isPlaceholderValue("[actual-secret-value]")).toBe(false);
  });

  it("reports adversarial sensitive assignments", () => {
    const assignment = ["AUTH0_SECRET", "real-secret-your_placeholder"].join(
      "=",
    );
    expect(findingsFor(assignment)).toContainEqual({
      path: "fixture",
      rule: "sensitive-env-assignment",
      scope: "test",
    });
  });

  it("accepts only complete environment references", () => {
    expect(isEnvironmentReference("process.env.AUTH0_SECRET")).toBe(true);
    expect(isEnvironmentReference('process.env["AUTH0_SECRET"]')).toBe(true);
    expect(isEnvironmentReference("env.AUTH0_SECRET")).toBe(true);
  });

  it("reports values that merely contain an environment reference", () => {
    const variable = "AUTH0_SECRET";
    const values = [
      "prefix-process.env.AUTH0_SECRET-suffix",
      "env.AUTH0_SECRET.extra",
    ];
    for (const value of values) {
      expect(findingsFor([variable, value].join("="))).toContainEqual({
        path: "fixture",
        rule: "sensitive-env-assignment",
        scope: "test",
      });
    }
  });

  it("continues scanning after a placeholder MongoDB URI", () => {
    const scheme = "mongodb" + "://";
    const text = [
      `${scheme}your_username:your_password@example.invalid/lawai`,
      `${scheme}admin:actual-value@example.invalid/lawai`,
    ].join("\n");
    expect(findingsFor(text)).toContainEqual({
      path: "fixture",
      rule: "credentialed-mongodb-uri",
      scope: "test",
    });
  });

  it("distinguishes non-credentialed examples from credentialed URIs", () => {
    const scheme = "mongodb" + "://";
    const variable = "MONGODB_URL";
    expect(
      findingsFor([variable, `${scheme}example.invalid/lawai`].join("=")),
    ).toEqual([]);
    expect(
      findingsFor(
        [variable, `${scheme}admin:actual-value@example.invalid/lawai`].join(
          "=",
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "credentialed-mongodb-uri" }),
        expect.objectContaining({ rule: "sensitive-env-assignment" }),
      ]),
    );
  });
});
