import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import {
  UserActivity,
  type IUserActivityMetadata,
  type UserActivityAction,
} from "@/models/userActivity";
import { readJsonObject, cleanBoundedString } from "@/lib/request";
import { getServerIdentity, hasAdminAccess } from "@/lib/serverAuth";
import { consumeRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 4_096;
const MAX_METADATA_BYTES = 512;
const MAX_ACTIVITY_DAYS = 90;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const ALLOWED_ACTIONS = new Set<UserActivityAction>([
  "login",
  "query",
  "view",
  "like",
  "bookmark",
  "chat",
]);
const ALLOWED_SOURCES = new Set(["home", "chat", "case", "recommendations"]);

const METADATA_KEYS: Record<UserActivityAction, ReadonlySet<string>> = {
  login: new Set(),
  query: new Set(["source"]),
  chat: new Set(["source"]),
  view: new Set(["recordId", "duration", "source"]),
  like: new Set(["recordId", "source"]),
  bookmark: new Set(["recordId", "source"]),
};

interface ActionCount {
  _id: UserActivityAction;
  count: number;
}

interface DailyActivity {
  _id: string;
  actions: number;
  queries: number;
  users: string[];
}

type MetadataResult =
  | { ok: true; value: IUserActivityMetadata | undefined }
  | { ok: false };

function parseDays(req: NextRequest): number | null {
  const value = req.nextUrl.searchParams.get("days") || "7";
  if (!/^\d{1,2}$/.test(value)) {
    return null;
  }
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= MAX_ACTIVITY_DAYS
    ? days
    : null;
}

function sanitizeMetadata(
  action: UserActivityAction,
  value: unknown,
): MetadataResult {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false };
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_METADATA_BYTES) {
    return { ok: false };
  }

  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (keys.some((key) => !METADATA_KEYS[action].has(key))) {
    return { ok: false };
  }

  const metadata: IUserActivityMetadata = {};
  if (raw.recordId !== undefined) {
    const recordId = cleanBoundedString(raw.recordId, { min: 24, max: 24 });
    if (!recordId || !OBJECT_ID_PATTERN.test(recordId)) {
      return { ok: false };
    }
    metadata.recordId = recordId;
  }

  if (raw.duration !== undefined) {
    if (
      typeof raw.duration !== "number" ||
      !Number.isFinite(raw.duration) ||
      raw.duration < 0 ||
      raw.duration > 3_600
    ) {
      return { ok: false };
    }
    metadata.duration = Math.round(raw.duration * 10) / 10;
  }

  if (raw.source !== undefined) {
    const source = cleanBoundedString(raw.source, { max: 32 });
    if (!source || !ALLOWED_SOURCES.has(source)) {
      return { ok: false };
    }
    metadata.source = source as IUserActivityMetadata["source"];
  }

  return {
    ok: true,
    value: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const identity = await getServerIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasAdminAccess(identity)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const days = parseDays(req);
    if (!days) {
      return NextResponse.json(
        { error: `days must be an integer from 1 to ${MAX_ACTIVITY_DAYS}` },
        { status: 400 },
      );
    }

    await DBconnect();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
    const match = { timestamp: { $gte: since } };

    const [
      totalActions,
      totalQueries,
      activeSubjects,
      actionCounts,
      dailyRows,
    ] = await Promise.all([
      UserActivity.countDocuments(match),
      UserActivity.countDocuments({
        ...match,
        action: { $in: ["query", "chat"] },
      }),
      UserActivity.distinct("userId", match),
      UserActivity.aggregate<ActionCount>([
        { $match: match },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      UserActivity.aggregate<DailyActivity>([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp",
                timezone: "UTC",
              },
            },
            actions: { $sum: 1 },
            queries: {
              $sum: {
                $cond: [{ $in: ["$action", ["query", "chat"]] }, 1, 0],
              },
            },
            users: { $addToSet: "$userId" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return NextResponse.json(
      {
        stats: {
          totalActions,
          totalQueries,
          activeUsers: activeSubjects.length,
          period: `${days} days`,
        },
        actionBreakdown: actionCounts.map((row) => ({
          action: row._id,
          count: row.count,
        })),
        dailyActivity: dailyRows.map((row) => ({
          date: row._id,
          actions: row.actions,
          queries: row.queries,
          activeUsers: row.users.length,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    console.error("Failed to aggregate admin activity stats");
    return NextResponse.json(
      { error: "Failed to fetch activity stats" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getServerIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await consumeRateLimit("activity", req, identity.subject))) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const body = await readJsonObject(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const actionValue = cleanBoundedString(body.value.action, { max: 16 });
    if (
      !actionValue ||
      !ALLOWED_ACTIONS.has(actionValue as UserActivityAction)
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const action = actionValue as UserActivityAction;
    const metadata = sanitizeMetadata(action, body.value.metadata);
    if (!metadata.ok) {
      return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
    }

    await DBconnect();
    await UserActivity.create({
      userId: identity.subject,
      action,
      timestamp: new Date(),
      ...(metadata.value ? { metadata: metadata.value } : {}),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    console.error("Failed to record authenticated activity");
    return NextResponse.json(
      { error: "Failed to log activity" },
      { status: 500 },
    );
  }
}
