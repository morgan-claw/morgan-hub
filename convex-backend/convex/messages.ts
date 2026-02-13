import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByTask = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const create = mutation({
  args: {
    taskId: v.string(),
    fromAgentId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      type: "message_posted",
      agentId: args.fromAgentId,
      message: `commented on task`,
      taskId: args.taskId,
      createdAt: Date.now(),
    });

    return messageId;
  },
});
