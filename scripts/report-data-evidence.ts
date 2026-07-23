/**
 * Read-only aggregate evidence report for MongoDB and Pinecone.
 *
 * The report never prints document text, titles, IDs, credentials, connection
 * strings, or arbitrary metadata values.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";
import { hasFlag, withRetry } from "./lib/safe-cli";

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "finalindex";
const NAMESPACE = process.env.PINECONE_NAMESPACE || "caselist";
const ID_ENUMERATION_CAP = 100_000;
const PINECONE_LIST_PAGE_SIZE = 100;
const PINECONE_LIST_PAGE_CAP = 2_000;

interface Availability {
  status: "available" | "unavailable";
  reason?: string;
}

interface MongoEvidence extends Availability {
  authority?: "authoritative";
  count?: number;
  categories?: {
    visibility: {
      public: number;
      restricted: number;
      missingOrInvalid: number;
    };
    sourceKind: {
      sourceDerived: number;
      synthetic: number;
      missingOrInvalid: number;
    };
    cail2018: number;
    needsReview: number;
  };
  documentIdCoverage?: {
    present: number;
    missing: number;
    uniqueValues: number;
    duplicateValues: number;
  };
  metadataValidity?: {
    valid: number;
    invalid: number;
    restrictedComplete: number;
    restrictedIncomplete: number;
  };
}

interface PineconeEvidence extends Availability {
  count?: {
    index: number;
    configuredNamespace: number;
  };
  categories?: "unavailable";
  documentIdEnumeration?:
    | {
        status: "available";
        count: number;
      }
    | {
        status: "unavailable";
        limitation: string;
      };
  limitation?: string;
}

interface MongoEvidenceResult {
  evidence: MongoEvidence;
  documentIds?: Set<string>;
  idEnumerationLimitation?: string;
}

interface PineconeEvidenceResult {
  evidence: PineconeEvidence;
  documentIds?: Set<string>;
  idEnumerationLimitation?: string;
}

type CrossStoreIdCoverage =
  | {
      status: "available";
      mongoIds: number;
      pineconeIds: number;
      intersection: number;
      mongoOnly: number;
      pineconeOnly: number;
      coveragePercent: number;
    }
  | {
      status: "unavailable";
      limitation: string;
    };

function compareIdCoverage(
  mongo: MongoEvidenceResult,
  pinecone: PineconeEvidenceResult,
): CrossStoreIdCoverage {
  if (!mongo.documentIds) {
    return {
      status: "unavailable",
      limitation:
        mongo.idEnumerationLimitation ||
        "MongoDB documentId enumeration was unavailable.",
    };
  }
  if (!pinecone.documentIds) {
    return {
      status: "unavailable",
      limitation:
        pinecone.idEnumerationLimitation ||
        "Pinecone ID enumeration was unavailable.",
    };
  }

  let intersection = 0;
  for (const documentId of mongo.documentIds) {
    if (pinecone.documentIds.has(documentId)) intersection++;
  }
  const mongoIds = mongo.documentIds.size;
  const pineconeIds = pinecone.documentIds.size;
  const coveragePercent =
    mongoIds === 0
      ? pineconeIds === 0
        ? 100
        : 0
      : Math.round((intersection / mongoIds) * 10_000) / 100;

  return {
    status: "available",
    mongoIds,
    pineconeIds,
    intersection,
    mongoOnly: mongoIds - intersection,
    pineconeOnly: pineconeIds - intersection,
    coveragePercent,
  };
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/report-data-evidence.ts [options]

Options:
  --help                       Show this help

The report is always read-only and emits aggregate, non-PII evidence only.
`);
}

const nonEmptyString = (field: string): Record<string, unknown> => ({
  [field]: { $type: "string", $regex: /\S/ },
});

const rawFgaObjectId = (): Record<string, unknown> => ({
  fgaObjectId: {
    $type: "string",
    $regex: /^(?!document:).*\S.*$/,
  },
});

async function collectMongoEvidence(): Promise<MongoEvidenceResult> {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    return {
      evidence: {
        status: "unavailable",
        reason: "MONGODB_URL credential/configuration is unavailable",
      },
      idEnumerationLimitation:
        "MongoDB credentials/configuration are unavailable.",
    };
  }

  try {
    await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10_000 });
    const collection = mongoose.connection.db!.collection("records");
    const [
      total,
      publicCount,
      restrictedCount,
      sourceDerivedCount,
      syntheticCount,
      cailCount,
      needsReviewCount,
      documentIdPresent,
      restrictedComplete,
      validMetadata,
      distinctResult,
      duplicateResult,
    ] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ visibility: "public" }),
      collection.countDocuments({ visibility: "restricted" }),
      collection.countDocuments({ sourceKind: "source-derived" }),
      collection.countDocuments({ sourceKind: "synthetic" }),
      collection.countDocuments({ source: "CAIL2018" }),
      collection.countDocuments({ needsReview: true }),
      collection.countDocuments(nonEmptyString("documentId")),
      collection.countDocuments({
        visibility: "restricted",
        ...nonEmptyString("documentId"),
        ...nonEmptyString("department"),
        ...nonEmptyString("sensitivity"),
        ...rawFgaObjectId(),
      }),
      collection.countDocuments({
        ...nonEmptyString("documentId"),
        visibility: { $in: ["public", "restricted"] },
        ...nonEmptyString("source"),
        sourceKind: { $in: ["source-derived", "synthetic"] },
        ...nonEmptyString("sourceUrl"),
        ...nonEmptyString("version"),
        $or: [
          { visibility: "public" },
          {
            visibility: "restricted",
            ...nonEmptyString("department"),
            ...nonEmptyString("sensitivity"),
            ...rawFgaObjectId(),
          },
        ],
      }),
      collection
        .aggregate<{
          count: number;
        }>([
          { $match: nonEmptyString("documentId") },
          { $group: { _id: "$documentId" } },
          { $count: "count" },
        ])
        .toArray(),
      collection
        .aggregate<{
          count: number;
        }>([
          { $match: nonEmptyString("documentId") },
          { $group: { _id: "$documentId", occurrences: { $sum: 1 } } },
          { $match: { occurrences: { $gt: 1 } } },
          { $count: "count" },
        ])
        .toArray(),
    ]);

    const uniqueValues = distinctResult[0]?.count || 0;
    const duplicateValues = duplicateResult[0]?.count || 0;
    let documentIds: Set<string> | undefined;
    let idEnumerationLimitation: string | undefined;
    if (uniqueValues > ID_ENUMERATION_CAP) {
      idEnumerationLimitation = `MongoDB has more than the ${ID_ENUMERATION_CAP} unique-ID safety cap; cross-store coverage was not computed.`;
    } else {
      documentIds = new Set<string>();
      const idCursor = collection.aggregate<{ _id: string }>([
        { $match: nonEmptyString("documentId") },
        { $group: { _id: "$documentId" } },
        { $limit: ID_ENUMERATION_CAP + 1 },
      ]);
      for await (const row of idCursor) {
        if (typeof row._id !== "string") {
          documentIds = undefined;
          idEnumerationLimitation =
            "MongoDB documentId enumeration returned a non-string value.";
          break;
        }
        documentIds.add(row._id);
      }
      if (documentIds && documentIds.size !== uniqueValues) {
        documentIds = undefined;
        idEnumerationLimitation =
          "MongoDB unique-ID count changed during the read-only report; cross-store coverage was not asserted.";
      }
    }

    return {
      evidence: {
        status: "available",
        authority: "authoritative",
        count: total,
        categories: {
          visibility: {
            public: publicCount,
            restricted: restrictedCount,
            missingOrInvalid: total - publicCount - restrictedCount,
          },
          sourceKind: {
            sourceDerived: sourceDerivedCount,
            synthetic: syntheticCount,
            missingOrInvalid: total - sourceDerivedCount - syntheticCount,
          },
          cail2018: cailCount,
          needsReview: needsReviewCount,
        },
        documentIdCoverage: {
          present: documentIdPresent,
          missing: total - documentIdPresent,
          uniqueValues,
          duplicateValues,
        },
        metadataValidity: {
          valid: validMetadata,
          invalid: total - validMetadata,
          restrictedComplete,
          restrictedIncomplete: restrictedCount - restrictedComplete,
        },
      },
      documentIds,
      idEnumerationLimitation,
    };
  } catch {
    return {
      evidence: {
        status: "unavailable",
        reason: "MongoDB aggregate query failed",
      },
      idEnumerationLimitation: "MongoDB aggregate/ID enumeration failed.",
    };
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => undefined);
    }
  }
}

async function collectPineconeEvidence(): Promise<PineconeEvidenceResult> {
  const apiKey = process.env.PINECONE_API_KEY;
  const host = process.env.HOST_ADD;
  if (!apiKey || !host) {
    return {
      evidence: {
        status: "unavailable",
        reason: "Pinecone credentials/configuration are unavailable",
      },
      idEnumerationLimitation:
        "Pinecone credentials/configuration are unavailable.",
    };
  }

  try {
    const pc = new Pinecone({ apiKey });
    const namespace = pc.index(INDEX_NAME, host).namespace(NAMESPACE);
    const stats = await withRetry(() => namespace.describeIndexStats());
    const namespaceCount = stats.namespaces?.[NAMESPACE]?.recordCount || 0;
    const documentIds = new Set<string>();
    const seenPaginationTokens = new Set<string>();
    let paginationToken: string | undefined;
    let observedItems = 0;
    let pages = 0;
    let enumerationLimitation: string | undefined;

    try {
      do {
        const page = await withRetry(
          () =>
            namespace.listPaginated({
              limit: PINECONE_LIST_PAGE_SIZE,
              ...(paginationToken ? { paginationToken } : {}),
            }),
          { attempts: 2 },
        );
        pages++;
        const vectors = page.vectors || [];
        if (observedItems + vectors.length > ID_ENUMERATION_CAP) {
          enumerationLimitation = `Pinecone ID enumeration exceeded the ${ID_ENUMERATION_CAP} safety cap.`;
          break;
        }
        observedItems += vectors.length;
        for (const vector of vectors) {
          if (typeof vector.id !== "string" || vector.id.length === 0) {
            enumerationLimitation =
              "Pinecone listPaginated returned an item without a valid ID.";
            break;
          }
          documentIds.add(vector.id);
        }
        if (enumerationLimitation) break;

        const next = page.pagination?.next;
        if (next && seenPaginationTokens.has(next)) {
          enumerationLimitation =
            "Pinecone listPaginated repeated a pagination token.";
          break;
        }
        if (next) seenPaginationTokens.add(next);
        if (next && observedItems >= ID_ENUMERATION_CAP) {
          enumerationLimitation = `Pinecone ID enumeration reached the ${ID_ENUMERATION_CAP} safety cap before the final page.`;
          break;
        }
        if (next && pages >= PINECONE_LIST_PAGE_CAP) {
          enumerationLimitation = `Pinecone ID enumeration reached the ${PINECONE_LIST_PAGE_CAP}-page safety cap before the final page.`;
          break;
        }
        paginationToken = next;
      } while (paginationToken);
    } catch {
      enumerationLimitation =
        "Pinecone listPaginated failed. ID listing is supported only for serverless indexes, and no reliable fallback exists for other index types.";
    }

    if (!enumerationLimitation && documentIds.size !== namespaceCount) {
      enumerationLimitation = `Pinecone stats count (${namespaceCount}) did not match the completed ID listing count (${documentIds.size}); coverage was not asserted.`;
    }

    const evidence: PineconeEvidence = {
      status: "available",
      count: {
        index: stats.totalRecordCount || 0,
        configuredNamespace: namespaceCount,
      },
      categories: "unavailable",
      documentIdEnumeration: enumerationLimitation
        ? {
            status: "unavailable",
            limitation: enumerationLimitation,
          }
        : {
            status: "available",
            count: documentIds.size,
          },
      limitation:
        "listPaginated enumerates IDs but not vector metadata, so Pinecone category counts are unavailable.",
    };
    return {
      evidence,
      documentIds: enumerationLimitation ? undefined : documentIds,
      idEnumerationLimitation: enumerationLimitation,
    };
  } catch {
    return {
      evidence: {
        status: "unavailable",
        reason: "Pinecone aggregate stats query failed",
        documentIdEnumeration: {
          status: "unavailable",
          limitation:
            "ID enumeration was not attempted because aggregate stats were unavailable.",
        },
      },
      idEnumerationLimitation:
        "Pinecone aggregate stats were unavailable, so ID coverage was not computed.",
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const [mongoResult, pineconeResult] = await Promise.all([
    collectMongoEvidence(),
    collectPineconeEvidence(),
  ]);
  const mongoPineconeIdCoverage = compareIdCoverage(
    mongoResult,
    pineconeResult,
  );
  console.log(
    JSON.stringify(
      {
        mongo: mongoResult.evidence,
        pinecone: pineconeResult.evidence,
        mongoPineconeIdCoverage,
      },
      null,
      2,
    ),
  );
}

main().catch(() => {
  console.error(
    JSON.stringify({
      status: "unavailable",
      reason: "Aggregate evidence report failed",
    }),
  );
  process.exitCode = 1;
});
