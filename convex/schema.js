import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  media: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("ready")),
    kind: v.union(v.literal("mascot"), v.literal("scene"), v.literal("video")),
    objectKey: v.string(),
    contentType: v.string(),
    size: v.number(),
    previewObjectKey: v.optional(v.string()),
    previewContentType: v.optional(v.string()),
    previewSize: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status_created", ["userId", "status", "createdAt"]),
});
