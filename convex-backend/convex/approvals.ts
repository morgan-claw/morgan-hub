import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("approvals")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("approvals").withIndex("by_created").order("desc").collect();
  },
});

export const listByAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("approvals")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .collect();
  },
});

export const listPending = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("approvals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    type: v.string(),
    action: v.string(),
    agentId: v.string(),
    content: v.string(),
    target: v.optional(v.string()),
    context: v.optional(v.string()),
    payload: v.optional(v.string()),
    urgency: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    taskId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("approvals", {
      ...args,
      status: "pending",
      createdAt: now,
    });

    await ctx.db.insert("activities", {
      type: "approval_submitted",
      agentId: args.agentId,
      message: `submitted approval: ${args.action}`,
      taskId: args.taskId,
      createdAt: now,
    });

    return id;
  },
});

export const review = mutation({
  args: {
    id: v.id("approvals"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    reviewedBy: v.string(),
    feedback: v.optional(v.string()),
    editedContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const approval = await ctx.db.get(args.id);
    if (!approval) throw new Error("Approval not found");

    await ctx.db.patch(args.id, {
      status: args.status,
      feedback: args.feedback,
      editedContent: args.editedContent,
      reviewedAt: now,
    });

    await ctx.db.insert("activities", {
      type: `approval_${args.status}`,
      agentId: args.reviewedBy,
      message: `${args.status} approval: ${approval.action}`,
      createdAt: now,
    });

    return { success: true };
  },
});

export const remove = mutation({
  args: {
    id: v.id("approvals"),
    deletedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.id);
    if (approval) {
      await ctx.db.insert("activities", {
        type: "approval_deleted",
        agentId: args.deletedBy,
        message: `deleted approval: ${approval.action}`,
        createdAt: Date.now(),
      });
    }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
