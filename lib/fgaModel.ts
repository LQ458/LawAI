import authorizationModel from "../fga/model.json";

export interface FgaAuthorizationModel {
  id?: string;
  schema_version: string;
  type_definitions: unknown[];
}

export const REQUIRED_FGA_MODEL: FgaAuthorizationModel = authorizationModel;

export type FgaModelStoreState = "empty" | "ready" | "unsafe";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)])
      .filter(([key, child]) => {
        if ((key === "condition" || key === "module") && child === "") {
          return false;
        }
        if ((key === "metadata" || key === "source_info") && child === null) {
          return false;
        }
        if (
          (key === "conditions" || key === "relations") &&
          child &&
          typeof child === "object" &&
          !Array.isArray(child) &&
          Object.keys(child).length === 0
        ) {
          return false;
        }
        return true;
      }),
  );
}

export function matchesRequiredFgaModel(model: unknown): boolean {
  if (!model || typeof model !== "object") return false;
  const candidate = model as Record<string, unknown>;
  const candidateWithoutModelId = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => key !== "id"),
  );
  return (
    JSON.stringify(canonicalize(candidateWithoutModelId)) ===
    JSON.stringify(canonicalize(REQUIRED_FGA_MODEL))
  );
}

export function getFgaModelStoreState(
  models: FgaAuthorizationModel[],
): FgaModelStoreState {
  if (models.length === 0) return "empty";
  if (models.length === 1 && matchesRequiredFgaModel(models[0])) return "ready";
  return "unsafe";
}
