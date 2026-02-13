import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    emoji: v.string(),
    color: v.string(),
    level: v.union(v.literal("lead"), v.literal("specialist")),
    sessionKey: v.string(),
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("blocked")),
    currentTaskId: v.optional(v.string()),
  }),

  tasks: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
    vaultPath: v.optional(v.string()),
    domain: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  }),

  messages: defineTable({
    taskId: v.string(),
    fromAgentId: v.string(),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  activities: defineTable({
    type: v.string(),
    agentId: v.string(),
    message: v.string(),
    taskId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol")
    ),
    taskId: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  approvals: defineTable({
    type: v.string(),
    action: v.string(),
    agentId: v.string(),
    content: v.string(),
    target: v.optional(v.string()),
    context: v.optional(v.string()),
    payload: v.optional(v.string()),
    urgency: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    taskId: v.optional(v.string()),
    feedback: v.optional(v.string()),
    editedContent: v.optional(v.string()),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
  }).index("by_status", ["status"])
    .index("by_agent", ["agentId"])
    .index("by_created", ["createdAt"]),

  notifications: defineTable({
    mentionedAgentId: v.string(),
    content: v.string(),
    taskId: v.optional(v.string()),
    delivered: v.boolean(),
    createdAt: v.number(),
  }).index("by_agent_delivered", ["mentionedAgentId", "delivered"]),
});
