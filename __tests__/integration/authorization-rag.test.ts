/** @jest-environment node */

import { type DocCandidate, filterDocsByAccess } from "@/lib/docAccess";
import {
  executeGroundedRag,
  type GroundedGenerationInput,
  type RagDependencies,
} from "@/lib/rag";

const documents: DocCandidate[] = [
  {
    id: "public-1",
    documentId: "public-1",
    title: "公开劳动法资料",
    description: "公开摘要：劳动争议可以通过法定渠道处理。",
    content: "公开正文：保存合同与工资记录，并核对当地有效规则。",
    visibility: "public",
    source: "CAIL2018",
    sourceKind: "source-derived",
  },
  {
    id: "salary-private",
    documentId: "salary-private",
    title: "受限薪酬方案",
    description: "受限摘要：内部薪酬调整。",
    content: "受限正文：仅供获准 HR 成员阅读。",
    visibility: "restricted",
    sensitivity: "confidential",
    department: "hr",
    fgaObjectId: "salary-private",
    source: "synthetic-demo",
    sourceKind: "synthetic",
  },
  {
    id: "denied-private",
    documentId: "denied-private",
    title: "不可见并购草案",
    description: "不可见摘要：内部并购安排。",
    content: "不可见正文：不得发送给模型。",
    visibility: "restricted",
    sensitivity: "restricted",
    department: "legal",
    fgaObjectId: "denied-private",
    source: "synthetic-demo",
    sourceKind: "synthetic",
  },
];

const metadata = documents.map(
  ({ id, documentId, visibility, sensitivity, department, fgaObjectId }) => ({
    id,
    documentId,
    visibility,
    sensitivity,
    department,
    fgaObjectId,
  }),
);

function dependenciesFor(
  subject: string | null,
  captured: GroundedGenerationInput[],
): RagDependencies {
  const check = jest.fn(
    async ({ object }: { object: string }) =>
      subject === "auth0|alice" && object === "salary-private",
  );

  return {
    retrieveCandidates: jest
      .fn()
      .mockResolvedValue(
        documents.map((document) => ({ id: document.id, score: 0.9 })),
      ),
    loadDocumentMetadata: jest.fn().mockResolvedValue(metadata),
    authorizeDocuments: (docs, authenticatedSubject) =>
      filterDocsByAccess(docs, authenticatedSubject, check),
    loadAuthorizedDocuments: jest.fn(async (authorizedMetadata) => {
      const allowed = new Set(
        authorizedMetadata.map(
          (document) => document.documentId || document.id,
        ),
      );
      return documents.filter((document) =>
        allowed.has(document.documentId || document.id),
      );
    }),
    generateAnswer: jest.fn(async (input) => {
      captured.push(input);
      return `请保存相关证据。[DOC:public-1]${
        subject === "auth0|alice"
          ? " 内部方案仅说明组织政策。[DOC:salary-private]"
          : ""
      }`;
    }),
  };
}

describe("mocked authorization and grounded RAG integration", () => {
  it("keeps denied title, summary, and body out of model context and sources", async () => {
    const captured: GroundedGenerationInput[] = [];
    const dependencies = dependenciesFor("auth0|alice", captured);
    const result = await executeGroundedRag(
      "如何处理劳动争议？",
      "auth0|alice",
      dependencies,
    );

    expect(dependencies.loadAuthorizedDocuments).toHaveBeenCalledWith([
      expect.objectContaining({ documentId: "public-1" }),
      expect.objectContaining({ documentId: "salary-private" }),
    ]);
    expect(
      JSON.stringify(
        (dependencies.loadAuthorizedDocuments as jest.Mock).mock.calls,
      ),
    ).not.toContain("denied-private");
    expect(captured).toHaveLength(1);
    expect(captured[0].context).toContain("公开劳动法资料");
    expect(captured[0].context).toContain("受限薪酬方案");
    expect(captured[0].context).not.toContain("不可见并购草案");
    expect(captured[0].context).not.toContain("不可见摘要");
    expect(captured[0].context).not.toContain("不可见正文");
    expect(result.sources.map((source) => source.id)).toEqual([
      "public-1",
      "salary-private",
    ]);
  });

  it("returns only public sources to anonymous users", async () => {
    const captured: GroundedGenerationInput[] = [];
    const result = await executeGroundedRag(
      "劳动争议",
      null,
      dependenciesFor(null, captured),
    );

    expect(result.sources.map((source) => source.id)).toEqual(["public-1"]);
    expect(captured[0].sourceIds).toEqual(["public-1"]);
  });

  it("allows Alice and denies Bob for the same restricted source", async () => {
    const alice = await executeGroundedRag(
      "薪酬",
      "auth0|alice",
      dependenciesFor("auth0|alice", []),
    );
    const bob = await executeGroundedRag(
      "薪酬",
      "auth0|bob",
      dependenciesFor("auth0|bob", []),
    );

    expect(alice.sources.map((source) => source.id)).toContain(
      "salary-private",
    );
    expect(bob.sources.map((source) => source.id)).toEqual(["public-1"]);
  });

  it("does not call the model when no authorized evidence remains", async () => {
    const generateAnswer = jest.fn();
    const result = await executeGroundedRag("薪酬", "auth0|bob", {
      retrieveCandidates: jest
        .fn()
        .mockResolvedValue([{ id: "salary-private", score: 0.9 }]),
      loadDocumentMetadata: jest.fn().mockResolvedValue([metadata[1]]),
      authorizeDocuments: (docs, subject) =>
        filterDocsByAccess(docs, subject, jest.fn().mockResolvedValue(false)),
      loadAuthorizedDocuments: jest.fn(),
      generateAnswer,
    });

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain("证据不足");
  });

  it("rejects model citations that do not belong to authorized sources", async () => {
    const result = await executeGroundedRag("劳动争议", null, {
      ...dependenciesFor(null, []),
      generateAnswer: jest.fn().mockResolvedValue("错误引用 [DOC:secret]"),
    });

    expect(result.answer).toContain("证据不足");
    expect(result.answer).not.toContain("[DOC:secret]");
  });
});
