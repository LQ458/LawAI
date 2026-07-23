import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";
import { filterDocsByAccess } from "@/lib/docAccess";
import { getServerIdentity } from "@/lib/serverAuth";
import { cleanBoundedString, readJsonObject } from "@/lib/request";

const MAX_BODY_BYTES = 8_192;
const MAX_TAGS = 20;

export async function POST(req: NextRequest) {
  try {
    let userSub: string | null = null;
    try {
      userSub = (await getServerIdentity(req))?.subject || null;
    } catch {
      // Identity-provider failure remains anonymous/public-only.
    }

    const body = await readJsonObject(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    const pageValue = body.value.page ?? 1;
    const pageSizeValue = body.value.pageSize ?? 12;
    const sort = cleanBoundedString(body.value.sort ?? "latest", { max: 16 });
    const tagsValue = body.value.tags ?? [];
    if (
      !Array.isArray(tagsValue) ||
      tagsValue.length > MAX_TAGS ||
      tagsValue.some(
        (tag) =>
          typeof tag !== "string" ||
          tag.trim().length === 0 ||
          tag.trim().length > 64,
      )
    ) {
      return NextResponse.json({ error: "invalid_tags" }, { status: 400 });
    }
    const tags = tagsValue.map((tag) => tag.trim());

    const safePage =
      typeof pageValue === "number" &&
      Number.isInteger(pageValue) &&
      pageValue > 0
        ? pageValue
        : 1;
    const safePageSize =
      typeof pageSizeValue === "number" &&
      Number.isInteger(pageSizeValue) &&
      pageSizeValue > 0
        ? Math.min(pageSizeValue, 50)
        : 12;

    await DBconnect();

    const query: Record<string, unknown> = {};
    if (tags.length > 0) {
      query.tags = { $in: tags };
    }

    let sortQuery = {};
    switch (sort) {
      case "latest":
        sortQuery = { lastUpdateTime: -1 };
        break;
      case "popular":
        sortQuery = { interactionScore: -1 };
        break;
      case "mostLiked":
        sortQuery = { likes: -1 };
        break;
      default:
        sortQuery = { lastUpdateTime: -1 };
    }

    const records = await Record.find(query)
      .sort(sortQuery)
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .lean();

    const authorizedDocuments = await filterDocsByAccess(
      records.map((record) => ({
        id: String(record._id),
        documentId: record.documentId,
        title: record.title,
        link: record.link,
        description: record.description,
        content: record.content,
        visibility: record.visibility,
        sensitivity: record.sensitivity,
        department: record.department,
        fgaObjectId: record.fgaObjectId,
        source: record.source,
        sourceKind: record.sourceKind,
      })),
      userSub,
    );
    const authorizedIds = new Set(
      authorizedDocuments.flatMap((document) => [
        document.id,
        document.documentId || "",
      ]),
    );
    const visibleRecords = records.filter(
      (record) =>
        authorizedIds.has(String(record._id)) ||
        authorizedIds.has(record.documentId || ""),
    );

    if (userSub) {
      const recordIds = visibleRecords
        .map((r) => r._id?.toString())
        .filter((id): id is string => {
          return id !== undefined && mongoose.Types.ObjectId.isValid(id);
        })
        .map((id) => new mongoose.Types.ObjectId(id));

      if (recordIds.length > 0) {
        const [likes, bookmarks] = await Promise.all([
          Like.find({
            userId: userSub,
            recordId: { $in: recordIds },
          }).lean(),
          Bookmark.find({
            userId: userSub,
            recordId: { $in: recordIds },
          }).lean(),
        ]);

        const likedRecordIds = new Set(likes.map((l) => l.recordId.toString()));
        const bookmarkedRecordIds = new Set(
          bookmarks.map((b) => b.recordId.toString()),
        );

        visibleRecords.forEach((r: Record<string, unknown>) => {
          const id = (r._id as mongoose.Types.ObjectId)?.toString();
          if (id) {
            (r as Record<string, unknown>).isLiked = likedRecordIds.has(id);
            (r as Record<string, unknown>).isBookmarked =
              bookmarkedRecordIds.has(id);
          }
        });
      }
    }

    return NextResponse.json({
      cases: visibleRecords.map((record) => ({
        _id: record._id,
        documentId: record.documentId,
        title: record.title,
        link: record.link,
        description: record.description,
        content: record.content,
        date: record.date,
        tags: record.tags,
        category: record.category,
        views: record.views,
        likes: record.likes,
        bookmarks: record.bookmarks,
        interactionScore: record.interactionScore,
        lastUpdateTime: record.lastUpdateTime,
        createdAt: record.createdAt,
        isLiked: record.isLiked,
        isBookmarked: record.isBookmarked,
      })),
    });
  } catch {
    console.error("Failed to fetch authorized cases");
    return NextResponse.json({ error: "获取案例列表失败" }, { status: 500 });
  }
}
