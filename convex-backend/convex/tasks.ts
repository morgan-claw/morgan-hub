import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    ),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    assigneeIds: v.array(v.string()),
    createdBy: v.string(),
    vaultPath: v.optional(v.string()),
    domain: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activities", {
      type: "task_created",
      agentId: args.createdBy,
      message: `created task: ${args.title}`,
      taskId: taskId.toString(),
      createdAt: now,
    });

    return taskId;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    )),
    priority: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"))),
    assigneeIds: v.optional(v.array(v.string())),
    updatedBy: v.string(),
    vaultPath: v.optional(v.string()),
    domain: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, updatedBy, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    // Log activity
    const task = await ctx.db.get(id);
    if (task) {
      await ctx.db.insert("activities", {
        type: "task_updated",
        agentId: updatedBy,
        message: `updated task: ${task.title}`,
        taskId: id.toString(),
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getByAssignee = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const allTasks = await ctx.db.query("tasks").collect();
    return allTasks.filter(task => task.assigneeIds.includes(args.agentId));
  },
});

export const remove = mutation({
  args: {
    id: v.id("tasks"),
    deletedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (task) {
      await ctx.db.insert("activities", {
        type: "task_deleted",
        agentId: args.deletedBy,
        message: `deleted task: ${task.title}`,
        createdAt: Date.now(),
      });
    }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
