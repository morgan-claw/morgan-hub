import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

export const update = mutation({
  args: {
    id: v.id("agents"),
    status: v.optional(v.union(v.literal("active"), v.literal("idle"), v.literal("blocked"))),
    currentTaskId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return { success: true };
  },
});
