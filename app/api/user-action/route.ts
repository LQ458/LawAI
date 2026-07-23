import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Record } from "@/models/record";
import { UserProfile } from "@/models/userProfile";
import DBconnect from "@/lib/mongodb";
import { filterDocsByAccess, type DocCandidate } from "@/lib/docAccess";
import { readJsonObject, cleanBoundedString } from "@/lib/request";
import { getServerIdentity } from "@/lib/serverAuth";

const MAX_BODY_BYTES = 2_048;
const MAX_DURATION_SECONDS = 3_600;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const ALLOWED_ACTIONS = new Set(["view", "like", "bookmark"]);

interface LeanRecordForAuthorization {
  _id: mongoose.Types.ObjectId;
  documentId?: string;
  title?: string;
  tags?: string[];
  visibility?: "public" | "restricted";
  sensitivity?: string;
  department?: string;
  fgaObjectId?: string;
  source?: string;
  sourceKind?: "source-derived" | "synthetic";
}

function toAuthorizationCandidate(
  record: LeanRecordForAuthorization,
): DocCandidate {
  return {
    id: record._id.toString(),
    documentId: record.documentId,
    title: record.title || "",
    visibility: record.visibility,
    sensitivity: record.sensitivity,
    department: record.department,
    fgaObjectId: record.fgaObjectId,
    source: record.source,
    sourceKind: record.sourceKind,
  };
}

function authorizationStableFilter(record: LeanRecordForAuthorization) {
  return {
    _id: record._id,
    visibility: record.visibility,
    ...(record.visibility === "restricted"
      ? {
          documentId: record.documentId,
          sensitivity: record.sensitivity,
          department: record.department,
          fgaObjectId: record.fgaObjectId,
        }
      : {}),
  };
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getServerIdentity(request);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonObject(request, MAX_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const action = cleanBoundedString(body.value.action, { max: 16 });
    const recordId = cleanBoundedString(body.value.recordId, {
      min: 24,
      max: 24,
    });
    if (
      !action ||
      !ALLOWED_ACTIONS.has(action) ||
      !recordId ||
      !OBJECT_ID_PATTERN.test(recordId)
    ) {
      return NextResponse.json(
        { error: "A valid action and record ID are required" },
        { status: 400 },
      );
    }

    if (body.value.duration !== undefined && action !== "view") {
      return NextResponse.json(
        { error: "Duration is only valid for view actions" },
        { status: 400 },
      );
    }
    if (
      body.value.duration !== undefined &&
      (typeof body.value.duration !== "number" ||
        !Number.isFinite(body.value.duration))
    ) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }
    const duration =
      action === "view" && typeof body.value.duration === "number"
        ? Math.min(MAX_DURATION_SECONDS, Math.max(0, body.value.duration))
        : 0;

    await DBconnect();
    const record = (await Record.findById(recordId)
      .select(
        "_id documentId title tags visibility sensitivity department fgaObjectId source sourceKind",
      )
      .lean()) as unknown as LeanRecordForAuthorization | null;

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const authorized = await filterDocsByAccess(
      [toAuthorizationCandidate(record)],
      identity.subject,
    );
    if (authorized.length !== 1) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const scoreIncrement =
      action === "view" ? 1 + duration * 0.1 : action === "like" ? 3 : 5;
    const updatedRecord = await Record.findOneAndUpdate(
      authorizationStableFilter(record),
      {
        $inc: {
          interactionScore: scoreIncrement,
          views: action === "view" ? 1 : 0,
        },
      },
    );
    if (!updatedRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let userProfile = await UserProfile.findOne({
      userId: identity.subject,
    });
    if (!userProfile) {
      userProfile = new UserProfile({
        userId: identity.subject,
        tagWeights: {},
        categoryWeights: {},
        interactions: {
          views: 0,
          likes: 0,
          bookmarks: 0,
          avgDuration: 0,
        },
      });
    }

    for (const tag of record.tags || []) {
      if (/^[\p{L}\p{N}_-]{1,64}$/u.test(tag)) {
        userProfile.tagWeights[tag] = (userProfile.tagWeights[tag] || 0) + 1;
      }
    }

    const interactions = userProfile.interactions;
    if (action === "view") {
      interactions.views += 1;
      if (duration > 0) {
        interactions.avgDuration =
          (interactions.avgDuration * (interactions.views - 1) + duration) /
          interactions.views;
      }
    } else if (action === "like") {
      interactions.likes += 1;
    } else {
      interactions.bookmarks += 1;
    }

    await userProfile.save();
    return NextResponse.json({ success: true });
  } catch {
    console.error("Authenticated user action failed");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
