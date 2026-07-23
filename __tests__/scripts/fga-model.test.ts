import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getFgaModelStoreState,
  matchesRequiredFgaModel,
  REQUIRED_FGA_MODEL,
} from "../../lib/fgaModel";

describe("FGA authorization model", () => {
  it("matches the document viewer and department membership policy", () => {
    const definitions = Object.fromEntries(
      REQUIRED_FGA_MODEL.type_definitions.map((definition) => {
        const typed = definition as Record<string, unknown>;
        return [typed.type, typed];
      }),
    );

    expect(Object.keys(definitions)).toEqual([
      "user",
      "department",
      "document",
    ]);
    expect(definitions.department).toMatchObject({
      relations: { member: { this: {} } },
      metadata: {
        relations: {
          member: {
            directly_related_user_types: [{ type: "user" }],
          },
        },
      },
    });
    expect(definitions.document).toMatchObject({
      relations: { viewer: { this: {} } },
      metadata: {
        relations: {
          viewer: {
            directly_related_user_types: [
              { type: "user" },
              { type: "department", relation: "member" },
            ],
          },
        },
      },
    });
  });

  it("keeps the deployable JSON and documented DSL aligned", () => {
    const dsl = readFileSync(resolve(process.cwd(), "fga/model.fga"), "utf8");

    expect(REQUIRED_FGA_MODEL.schema_version).toBe("1.1");
    expect(matchesRequiredFgaModel(REQUIRED_FGA_MODEL)).toBe(true);
    expect(
      matchesRequiredFgaModel({ ...REQUIRED_FGA_MODEL, id: "ignored" }),
    ).toBe(true);
    expect(dsl).toContain("define member: [user]");
    expect(dsl).toContain("define viewer: [user, department#member]");
  });

  it("treats only one exact model as ready", () => {
    const required = { ...REQUIRED_FGA_MODEL, id: "required" };
    const mismatched = {
      ...REQUIRED_FGA_MODEL,
      id: "mismatched",
      schema_version: "1.0",
    };

    expect(getFgaModelStoreState([])).toBe("empty");
    expect(getFgaModelStoreState([required])).toBe("ready");
    expect(getFgaModelStoreState([mismatched])).toBe("unsafe");
    expect(getFgaModelStoreState([required, mismatched])).toBe("unsafe");
    expect(getFgaModelStoreState([required, required])).toBe("unsafe");
  });

  it("accepts only semantically empty service defaults", () => {
    const serviceNormalized = {
      id: "service-model",
      schema_version: REQUIRED_FGA_MODEL.schema_version,
      type_definitions: REQUIRED_FGA_MODEL.type_definitions.map(
        (definition) => {
          const typed = definition as Record<string, unknown>;
          if (typed.type === "user") {
            return { ...typed, relations: {}, metadata: null };
          }
          const metadata = typed.metadata as Record<string, unknown>;
          const relations = metadata.relations as Record<
            string,
            Record<string, unknown>
          >;
          return {
            ...typed,
            metadata: {
              ...metadata,
              module: "",
              source_info: null,
              relations: Object.fromEntries(
                Object.entries(relations).map(([name, relation]) => [
                  name,
                  {
                    ...relation,
                    module: "",
                    source_info: null,
                    directly_related_user_types: (
                      relation.directly_related_user_types as Record<
                        string,
                        unknown
                      >[]
                    ).map((related) => ({ ...related, condition: "" })),
                  },
                ]),
              ),
            },
          };
        },
      ),
      conditions: {},
    };

    expect(matchesRequiredFgaModel(serviceNormalized)).toBe(true);
    expect(
      matchesRequiredFgaModel({
        ...serviceNormalized,
        conditions: { non_empty: { name: "non_empty" } },
      }),
    ).toBe(false);
    expect(
      matchesRequiredFgaModel({
        ...serviceNormalized,
        type_definitions: [
          ...serviceNormalized.type_definitions,
          { type: "unexpected", id: "must-not-be-ignored" },
        ],
      }),
    ).toBe(false);
  });
});
