/** @jest-environment node */

import { type DocCandidate, filterDocsByAccess } from "@/lib/docAccess";
import { toFgaUserObject } from "@/lib/fgaIdentity";

const publicDocument: DocCandidate = {
  id: "public-doc",
  documentId: "public-doc",
  title: "Public source",
  visibility: "public",
};

const restrictedDocument: DocCandidate = {
  id: "restricted-doc",
  documentId: "restricted-doc",
  title: "Restricted source",
  visibility: "restricted",
  department: "hr",
  sensitivity: "confidential",
  fgaObjectId: "restricted-doc",
};

describe("document authorization", () => {
  it("allows anonymous access only to explicitly public documents", async () => {
    const check = jest.fn().mockResolvedValue(true);
    const result = await filterDocsByAccess(
      [
        publicDocument,
        restrictedDocument,
        { id: "missing", title: "Missing metadata" },
      ],
      null,
      check,
    );

    expect(result).toEqual([publicDocument]);
    expect(check).not.toHaveBeenCalled();
  });

  it("allows Alice to read a permitted restricted document", async () => {
    const check = jest.fn().mockResolvedValue(true);
    const result = await filterDocsByAccess(
      [restrictedDocument],
      "auth0|alice",
      check,
    );

    expect(result).toEqual([restrictedDocument]);
    expect(check).toHaveBeenCalledWith({
      user: toFgaUserObject("auth0|alice"),
      relation: "viewer",
      object: "restricted-doc",
    });
  });

  it("denies Bob for the same restricted document", async () => {
    const result = await filterDocsByAccess(
      [restrictedDocument],
      "auth0|bob",
      jest.fn().mockResolvedValue(false),
    );

    expect(result).toEqual([]);
  });

  it.each([
    ["missing FGA configuration", false],
    ["FGA request failure", new Error("timeout")],
  ])("fails closed for restricted documents when %s", async (_, outcome) => {
    const check =
      outcome instanceof Error
        ? jest.fn().mockRejectedValue(outcome)
        : jest.fn().mockResolvedValue(outcome);

    await expect(
      filterDocsByAccess([restrictedDocument], "auth0|alice", check),
    ).resolves.toEqual([]);
  });

  it("denies restricted documents with incomplete metadata without calling FGA", async () => {
    const check = jest.fn().mockResolvedValue(true);
    const result = await filterDocsByAccess(
      [
        {
          ...restrictedDocument,
          fgaObjectId: undefined,
        },
      ],
      "auth0|alice",
      check,
    );

    expect(result).toEqual([]);
    expect(check).not.toHaveBeenCalled();
  });
});
