import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

const mediaKind = v.union(v.literal("mascot"), v.literal("scene"), v.literal("video"));

async function requireUserId(ctx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Unauthenticated");
  return userId;
}

function validateReservation(args) {
  if (!Number.isSafeInteger(args.size) || args.size <= 0) throw new Error("Invalid media size.");
  if (args.kind === "video") {
    if (args.contentType !== "video/quicktime") throw new Error("Invalid video content type.");
    if (args.previewContentType !== "video/mp4" || !args.previewSize) {
      throw new Error("A video preview is required.");
    }
    return { assetExtension: "mov", previewExtension: "mp4" };
  }
  if (args.contentType !== "image/png") throw new Error("Invalid image content type.");
  if (args.previewContentType || args.previewSize) throw new Error("Image previews are not supported.");
  return { assetExtension: "png" };
}

export const reserve = mutation({
  args: {
    kind: mediaKind,
    contentType: v.string(),
    size: v.number(),
    previewContentType: v.optional(v.string()),
    previewSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const extensions = validateReservation(args);
    const generationId = crypto.randomUUID();
    const prefix = `users/${userId}/media/${generationId}`;
    const objectKey = `${prefix}/asset.${extensions.assetExtension}`;
    const previewObjectKey = extensions.previewExtension
      ? `${prefix}/preview.${extensions.previewExtension}`
      : undefined;

    const mediaId = await ctx.db.insert("media", {
      userId,
      status: "pending",
      ...args,
      objectKey,
      previewObjectKey,
      createdAt: Date.now(),
    });
    return { mediaId, objectKey, previewObjectKey };
  },
});

export const finalize = mutation({
  args: { id: v.id("media") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const media = await ctx.db.get(id);
    if (!media || media.userId !== userId) throw new Error("Not found");
    if (media.status === "ready") return;
    await ctx.db.patch(id, { status: "ready" });
  },
});

export const abort = mutation({
  args: { id: v.id("media") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const media = await ctx.db.get(id);
    if (!media || media.userId !== userId || media.status !== "pending") return;
    await ctx.db.delete(id);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("media")
      .withIndex("by_user_status_created", (q) => q.eq("userId", userId).eq("status", "ready"))
      .order("desc")
      .take(100);
  },
});

export const getMine = query({
  args: { id: v.id("media") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const media = await ctx.db.get(id);
    if (!media || media.userId !== userId || media.status !== "ready") return null;
    return media;
  },
});
