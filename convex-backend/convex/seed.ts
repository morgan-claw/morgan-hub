import { mutation } from "./_generated/server";

export const seedData = mutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existingAgents = await ctx.db.query("agents").collect();
    if (existingAgents.length > 0) {
      return { message: "Database already seeded" };
    }

    // Seed agents (using name as identifier since Convex generates _id)
    const agents = [
      {
        name: "Morgan",
        role: "Orchestrator",
        emoji: "M",
        color: "#FF4500",
        level: "lead" as const,
        sessionKey: "agent:main:main",
        status: "active" as const,
      },
      {
        name: "Atlas",
        role: "Operations",
        emoji: "A",
        color: "#3b82f6",
        level: "lead" as const,
        sessionKey: "agent:ops:main",
        status: "idle" as const,
      },
      {
        name: "Forge",
        role: "Engineering",
        emoji: "F",
        color: "#8b5cf6",
        level: "specialist" as const,
        sessionKey: "agent:tech:main",
        status: "idle" as const,
      },
      {
        name: "Echo",
        role: "Content",
        emoji: "E",
        color: "#ec4899",
        level: "specialist" as const,
        sessionKey: "agent:content:main",
        status: "idle" as const,
      },
      {
        name: "Haven",
        role: "Personal",
        emoji: "H",
        color: "#22c55e",
        level: "specialist" as const,
        sessionKey: "agent:personal:main",
        status: "idle" as const,
      },
      {
        name: "Scout",
        role: "Research",
        emoji: "S",
        color: "#f59e0b",
        level: "specialist" as const,
        sessionKey: "agent:research:main",
        status: "idle" as const,
      },
    ];

    for (const agent of agents) {
      await ctx.db.insert("agents", agent);
    }

    // Seed tasks
    const now = Date.now();
    const tasks = [
      {
        title: "Review ProClawed landing page v2",
        description:
          "Noah needs to review the landing page built overnight. Red accent, speed angle, premium feel. Files in projects/proclawed/. Check pricing tiers: Audit $750, Deploy $2.5-5K, Configure $5-15K, Manage $500-2K/mo.",
        status: "review" as const,
        priority: "high" as const,
        assigneeIds: ["echo", "forge"],
        createdBy: "morgan",
        createdAt: now - 8 * 3600000, // 8 hours ago
        updatedAt: now - 30 * 60000, // 30 min ago
      },
      {
        title: "Fill out LinkedIn Engagement segments (5x20 people)",
        description:
          "Build 5 segments of 20 people each for daily LinkedIn engagement. 20-30 min daily rhythm. Target: 5-7 post comments + 20-25 outreach messages/week.",
        status: "assigned" as const,
        priority: "high" as const,
        assigneeIds: ["atlas"],
        createdBy: "noah",
        createdAt: now - 4 * 3600000,
        updatedAt: now - 4 * 3600000,
      },
      {
        title: "ProClawed content strategy — first 30 days",
        description:
          "Draft content calendar for ProClawed launch. LinkedIn posts, Twitter threads, case studies. Echo handles strategy, Forge handles technical content.",
        status: "in_progress" as const,
        priority: "normal" as const,
        assigneeIds: ["echo", "forge"],
        createdBy: "morgan",
        createdAt: now - 6 * 3600000,
        updatedAt: now - 2 * 3600000,
      },
      {
        title: "Set up Gmail API access for Morgan",
        description:
          "Programmatic email access for Morgan. OAuth2 flow, refresh tokens, scripts for send/read. Credential storage in .secrets.env.",
        status: "done" as const,
        priority: "normal" as const,
        assigneeIds: ["morgan"],
        createdBy: "noah",
        createdAt: now - 5 * 3600000,
        updatedAt: now - 1 * 3600000,
      },
      {
        title: "Morgan Hub — Mission Control system",
        description:
          "Build the shared task management system. Dashboard, chat, kanban board, activity feed, agent integration. Private on Tailscale.",
        status: "in_progress" as const,
        priority: "high" as const,
        assigneeIds: ["morgan"],
        createdBy: "noah",
        createdAt: now - 1 * 3600000,
        updatedAt: now - 30 * 60000,
      },
      {
        title: "Haven cron job proposals — review 13 items",
        description:
          "Haven proposed 13 cron jobs in #life for habits, meal prep, health tracking. Noah needs to review and approve/reject each.",
        status: "review" as const,
        priority: "normal" as const,
        assigneeIds: ["haven"],
        createdBy: "haven",
        createdAt: now - 18 * 3600000,
        updatedAt: now - 4 * 3600000,
      },
      {
        title: "Research teaching opportunities at Toronto post-secondaries",
        description:
          "Noah interested in paid teaching/sessional roles. Research OCAD, George Brown, Sheridan, U of T continuing studies. Focus on design, tech, AI curriculum.",
        status: "inbox" as const,
        priority: "low" as const,
        assigneeIds: [],
        createdBy: "noah",
        createdAt: now,
        updatedAt: now,
      },
      {
        title: "@proclawed Twitter account — grow following",
        description:
          "18 accounts followed today from Noah's following list. Continue organic growth. Engage with AI/SaaS community. No automated posting without approval.",
        status: "done" as const,
        priority: "normal" as const,
        assigneeIds: ["morgan"],
        createdBy: "morgan",
        createdAt: now - 2 * 3600000,
        updatedAt: now - 30 * 60000,
      },
    ];

    for (const task of tasks) {
      await ctx.db.insert("tasks", task);
    }

    // Seed some initial activities
    await ctx.db.insert("activities", {
      type: "system",
      agentId: "morgan",
      message: "Mission Control system initialized",
      createdAt: now,
    });

    return { message: "Database seeded successfully" };
  },
});
