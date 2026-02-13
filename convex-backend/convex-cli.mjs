#!/usr/bin/env node
/**
 * Convex CLI wrapper for agents to interact with Mission Control
 * Usage: node convex-cli.mjs <command> [args...]
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = "https://befitting-opossum-812.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

const commands = {
  // List all tasks
  "tasks:list": async () => {
    const tasks = await client.query("tasks:list");
    console.log(JSON.stringify(tasks, null, 2));
  },

  // Get tasks for an agent
  "tasks:mine": async (agentName) => {
    if (!agentName) throw new Error("Usage: tasks:mine <agentName>");
    const tasks = await client.query("tasks:getByAssignee", { agentId: agentName.toLowerCase() });
    console.log(JSON.stringify(tasks, null, 2));
  },

  // Create a new task
  "tasks:create": async (title, description, priority = "normal", assignees = "") => {
    if (!title) throw new Error("Usage: tasks:create <title> <description> [priority] [assignees]");
    const assigneeIds = assignees ? assignees.split(",").map(a => a.trim().toLowerCase()) : [];
    const result = await client.mutation("tasks:create", {
      title,
      description: description || "",
      priority,
      assigneeIds,
      status: assigneeIds.length > 0 ? "assigned" : "inbox",
      createdBy: "cli",
    });
    console.log("Task created:", result);
  },

  // Update task status
  "tasks:update": async (taskId, status) => {
    if (!taskId || !status) throw new Error("Usage: tasks:update <taskId> <status>");
    await client.mutation("tasks:update", {
      id: taskId,
      status,
      updatedBy: "cli",
    });
    console.log("Task updated");
  },

  // Post a comment
  "messages:post": async (taskId, fromAgent, content) => {
    if (!taskId || !fromAgent || !content) {
      throw new Error("Usage: messages:post <taskId> <fromAgent> <content>");
    }
    await client.mutation("messages:create", {
      taskId,
      fromAgentId: fromAgent.toLowerCase(),
      content,
    });
    console.log("Comment posted");
  },

  // List agents
  "agents:list": async () => {
    const agents = await client.query("agents:list");
    console.log(JSON.stringify(agents, null, 2));
  },

  // Get activities
  "activities:list": async (limit = "50") => {
    const activities = await client.query("activities:list", { limit: parseInt(limit) });
    console.log(JSON.stringify(activities, null, 2));
  },

  // Log an activity
  "activities:log": async (agentName, message, taskId = null) => {
    if (!agentName || !message) {
      throw new Error("Usage: activities:log <agentName> <message> [taskId]");
    }
    await client.mutation("activities:create", {
      type: "agent_action",
      agentId: agentName.toLowerCase(),
      message,
      taskId: taskId || undefined,
    });
    console.log("Activity logged");
  },

  // Help
  help: () => {
    console.log(`
Mission Control CLI

Commands:
  tasks:list                                  - List all tasks
  tasks:mine <agentName>                      - Get tasks for an agent
  tasks:create <title> <desc> [pri] [agents]  - Create a new task
  tasks:update <taskId> <status>              - Update task status
  messages:post <taskId> <agent> <content>    - Post a comment
  agents:list                                 - List all agents
  activities:list [limit]                     - Get recent activities
  activities:log <agent> <message> [taskId]   - Log an activity
  help                                        - Show this help
    `);
  },
};

// Main
const [,, command, ...args] = process.argv;

if (!command || command === "help") {
  commands.help();
  process.exit(0);
}

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}

try {
  await commands[command](...args);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
