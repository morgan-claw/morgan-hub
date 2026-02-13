#!/usr/bin/env node
/**
 * Mission Control Agent CLI
 * Agent task management interface using Convex backend
 * 
 * Usage: node scripts/mc-agent.js <command> [args...]
 * (Run from projects/morgan-hub directory)
 */

import { ConvexHttpClient } from "../convex-backend/node_modules/convex/dist/esm/browser/index.js";

const CONVEX_URL = 'https://befitting-opossum-812.convex.cloud';
const client = new ConvexHttpClient(CONVEX_URL);

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] || true;
      i++;
    } else {
      positional.push(args[i]);
    }
  }
  return { flags, positional };
}

const commands = {
  async status(agentId) {
    if (!agentId) throw new Error('Usage: mc-agent.js status <agentId>');
    
    const tasks = await client.query("tasks:getByAssignee", { agentId: agentId.toLowerCase() });
    
    console.log(`\n📋 Mission Control — ${agentId}\n`);
    
    const byStatus = {
      assigned: tasks.filter(t => t.status === 'assigned'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      blocked: tasks.filter(t => t.status === 'blocked'),
      review: tasks.filter(t => t.status === 'review'),
      done: tasks.filter(t => t.status === 'done')
    };

    Object.entries(byStatus).forEach(([status, items]) => {
      if (items.length > 0) {
        console.log(`${status.toUpperCase()} (${items.length}):`);
        items.forEach(t => {
          const priority = t.priority === 'high' ? '🔴' : t.priority === 'normal' ? '🟡' : '⚪';
          const due = t.dueDate ? ` [due ${t.dueDate}]` : '';
          const domain = t.domain ? ` (${t.domain})` : '';
          const tags = t.tags?.length ? ` #${t.tags.join(' #')}` : '';
          console.log(`  ${priority} [${t._id}] ${t.title}${due}${domain}${tags}`);
        });
        console.log();
      }
    });

    console.log(`Total: ${tasks.length} tasks\n`);
  },

  async create(...rawArgs) {
    const { flags, positional } = parseFlags(rawArgs);
    const title = positional[0];
    const agentId = positional[1];
    
    if (!title || !agentId) {
      throw new Error('Usage: mc-agent.js create <title> <agentId> [--priority high/normal/low] [--vault <path>] [--domain <domain>] [--due <date>] [--assign <id,...>] [--tags <t1,t2>] [--desc <text>]');
    }

    const assigneeIds = flags.assign ? flags.assign.split(',') : [agentId.toLowerCase()];
    const tags = flags.tags ? flags.tags.split(',') : undefined;

    const task = {
      title,
      status: 'assigned',
      priority: flags.priority || 'normal',
      assigneeIds,
      createdBy: agentId.toLowerCase(),
    };
    if (flags.desc) task.description = flags.desc;
    if (flags.vault) task.vaultPath = flags.vault;
    if (flags.domain) task.domain = flags.domain;
    if (flags.due) task.dueDate = flags.due;
    if (tags) task.tags = tags;

    const id = await client.mutation("tasks:create", task);

    await client.mutation("activities:create", {
      type: 'agent_action',
      agentId: agentId.toLowerCase(),
      message: `Created task: ${title}`,
      taskId: id
    });

    console.log(`✅ Created task ${id}: ${title}`);
  },

  async list() {
    // Get tasks for all known agents
    const agents = ['morgan', 'atlas', 'forge', 'echo', 'haven', 'scout'];
    const allTasks = [];
    
    for (const agentId of agents) {
      try {
        const tasks = await client.query("tasks:getByAssignee", { agentId });
        tasks.forEach(t => allTasks.push(t));
      } catch { /* agent may have no tasks */ }
    }

    // Deduplicate by _id
    const seen = new Set();
    const unique = allTasks.filter(t => {
      if (seen.has(t._id)) return false;
      seen.add(t._id);
      return true;
    });

    const active = unique.filter(t => t.status !== 'done' && t.status !== 'archived');
    
    console.log(`\n📋 All Active Tasks (${active.length})\n`);
    
    const byAgent = {};
    active.forEach(t => {
      const assignees = t.assigneeIds?.join(',') || 'unassigned';
      if (!byAgent[assignees]) byAgent[assignees] = [];
      byAgent[assignees].push(t);
    });

    Object.entries(byAgent).forEach(([agent, tasks]) => {
      console.log(`${agent.toUpperCase()}:`);
      tasks.forEach(t => {
        const priority = t.priority === 'high' ? '🔴' : t.priority === 'normal' ? '🟡' : '⚪';
        const due = t.dueDate ? ` [due ${t.dueDate}]` : '';
        const status = t.status.replace('_', ' ');
        console.log(`  ${priority} [${status}] ${t.title}${due}`);
      });
      console.log();
    });
  },

  async pickup(taskId, agentId) {
    if (!taskId || !agentId) throw new Error('Usage: mc-agent.js pickup <taskId> <agentId>');
    
    await client.mutation("tasks:update", { id: taskId, status: 'in_progress', updatedBy: agentId.toLowerCase() });
    await client.mutation("activities:create", { type: 'agent_action', agentId: agentId.toLowerCase(), message: `Picked up task: ${taskId}`, taskId });
    console.log(`✅ Task ${taskId} moved to in_progress`);
  },

  async update(taskId, status, agentId) {
    if (!taskId || !status || !agentId) throw new Error('Usage: mc-agent.js update <taskId> <status> <agentId>');

    const validStatuses = ['inbox', 'assigned', 'in_progress', 'blocked', 'review', 'done', 'archived'];
    if (!validStatuses.includes(status)) throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);

    await client.mutation("tasks:update", { id: taskId, status, updatedBy: agentId.toLowerCase() });
    await client.mutation("activities:create", { type: 'agent_action', agentId: agentId.toLowerCase(), message: `Updated task ${taskId} to ${status}`, taskId });
    console.log(`✅ Task ${taskId} updated to ${status}`);
  },

  async comment(taskId, agentId, ...messageParts) {
    if (!taskId || !agentId || messageParts.length === 0) throw new Error('Usage: mc-agent.js comment <taskId> <agentId> <message>');
    await client.mutation("messages:create", { taskId, fromAgentId: agentId.toLowerCase(), content: messageParts.join(' ') });
    console.log(`✅ Comment added to task ${taskId}`);
  },

  async complete(taskId, agentId) {
    if (!taskId || !agentId) throw new Error('Usage: mc-agent.js complete <taskId> <agentId>');
    await client.mutation("tasks:update", { id: taskId, status: 'done', updatedBy: agentId.toLowerCase() });
    await client.mutation("activities:create", { type: 'agent_action', agentId: agentId.toLowerCase(), message: `Completed task: ${taskId}`, taskId });
    console.log(`✅ Task ${taskId} marked as done`);
  },

  async log(agentId, ...messageParts) {
    if (!agentId || messageParts.length === 0) throw new Error('Usage: mc-agent.js log <agentId> <message> [taskId]');

    const lastPart = messageParts[messageParts.length - 1];
    let taskId = undefined;
    let message = messageParts.join(' ');

    if (lastPart.match(/^j[a-z0-9]{20,}$/)) {
      taskId = lastPart;
      message = messageParts.slice(0, -1).join(' ');
    }

    await client.mutation("activities:create", { type: 'agent_action', agentId: agentId.toLowerCase(), message, taskId });
    console.log(`✅ Activity logged for ${agentId}`);
  },

  async submit(...rawArgs) {
    const { flags, positional } = parseFlags(rawArgs);
    const agentId = positional[0];
    if (!agentId || !flags.type || !flags.action || !flags.content) {
      throw new Error('Usage: mc-agent.js submit <agentId> --type <type> --action "..." --content "..." [--target "..."] [--context "..."] [--urgency high] [--task <taskId>] [--payload \'{}\']\n');
    }
    const urgency = flags.urgency || 'normal';
    if (!['low', 'normal', 'high'].includes(urgency)) throw new Error('Urgency must be low, normal, or high');

    const args = {
      type: flags.type,
      action: flags.action,
      agentId: agentId.toLowerCase(),
      content: flags.content,
      urgency,
    };
    if (flags.target) args.target = flags.target;
    if (flags.context) args.context = flags.context;
    if (flags.payload) args.payload = flags.payload;
    if (flags.task) args.taskId = flags.task;

    const id = await client.mutation("approvals:create", args);
    console.log(`✅ Submitted approval ${id} (${flags.type}: ${flags.action})`);
  },

  async approvals(...rawArgs) {
    const { positional } = parseFlags(rawArgs);
    const agentId = positional[0];

    let items;
    if (agentId) {
      const all = await client.query("approvals:listByAgent", { agentId: agentId.toLowerCase() });
      items = all.filter(a => a.status === 'pending');
    } else {
      items = await client.query("approvals:listPending", {});
    }

    console.log(`\n📋 Pending Approvals (${items.length})\n`);
    if (items.length === 0) { console.log('  No pending approvals.\n'); return; }

    items.forEach(a => {
      const urg = a.urgency === 'high' ? '🔴' : a.urgency === 'normal' ? '🟡' : '⚪';
      const target = a.target ? ` → ${a.target}` : '';
      console.log(`  ${urg} [${a._id}] ${a.type}: ${a.action}${target}`);
      console.log(`     Agent: ${a.agentId} | Created: ${new Date(a.createdAt).toLocaleString()}`);
      if (a.context) console.log(`     Context: ${a.context}`);
      console.log(`     Content: ${a.content.slice(0, 100)}${a.content.length > 100 ? '...' : ''}`);
      console.log();
    });
  },

  async approve(...rawArgs) {
    const { flags, positional } = parseFlags(rawArgs);
    const approvalId = positional[0];
    const agentId = positional[1];
    if (!approvalId || !agentId) throw new Error('Usage: mc-agent.js approve <approvalId> <agentId> [--feedback "..."] [--edit "edited content"]');

    const args = {
      id: approvalId,
      status: 'approved',
      reviewedBy: agentId.toLowerCase(),
    };
    if (flags.feedback) args.feedback = flags.feedback;
    if (flags.edit) args.editedContent = flags.edit;

    await client.mutation("approvals:review", args);
    console.log(`✅ Approved ${approvalId}`);
  },

  async reject(...rawArgs) {
    const { flags, positional } = parseFlags(rawArgs);
    const approvalId = positional[0];
    const agentId = positional[1];
    if (!approvalId || !agentId) throw new Error('Usage: mc-agent.js reject <approvalId> <agentId> [--feedback "reason"]');

    const args = {
      id: approvalId,
      status: 'rejected',
      reviewedBy: agentId.toLowerCase(),
    };
    if (flags.feedback) args.feedback = flags.feedback;

    await client.mutation("approvals:review", args);
    console.log(`❌ Rejected ${approvalId}`);
  },

  help() {
    console.log(`
Mission Control Agent CLI

Commands:
  status <agentId>                        - Show all tasks for an agent
  create <title> <agentId> [flags]        - Create a new task
  list                                    - Show all active tasks across all agents
  pickup <taskId> <agentId>               - Pick up a task (move to in_progress)
  update <taskId> <status> <agentId>      - Update task status
  comment <taskId> <agentId> <message>    - Add a comment to a task
  complete <taskId> <agentId>             - Mark task as done
  log <agentId> <message> [taskId]        - Log an activity

Approval Commands:
  submit <agentId> [flags]                - Submit an approval request
  approvals [agentId]                     - List pending approvals
  approve <approvalId> <agentId> [flags]  - Approve a request
  reject <approvalId> <agentId> [flags]   - Reject a request

Create flags:
  --priority high|normal|low    Task priority (default: normal)
  --vault <path>                Vault file path
  --domain <domain>             Domain (work, personal, ops, etc.)
  --due <date>                  Due date (YYYY-MM-DD)
  --assign <id1,id2>            Assignee agent IDs (default: agentId)
  --tags <tag1,tag2>            Comma-separated tags
  --desc <text>                 Description

Submit flags:
  --type <type>                 Type (email, tweet, linkedin, outreach, calendar, financial, deploy, purchase, other)
  --action "..."                What happens on approval
  --content "..."               Draft content or description
  --target "..."                Recipient, platform, etc.
  --context "..."               Why the agent wants to do this
  --urgency high|normal|low     Urgency (default: normal)
  --task <taskId>               Link to originating task
  --payload '{}'                JSON blob for structured data

Approve/Reject flags:
  --feedback "..."              Reason or notes
  --edit "..."                  Edited content (approve only)

Statuses: inbox, assigned, in_progress, blocked, review, done, archived

Examples:
  node scripts/mc-agent.js create "Deploy auth system" forge --priority high --due 2026-02-15 --domain work
  node scripts/mc-agent.js list
  node scripts/mc-agent.js status morgan
  node scripts/mc-agent.js pickup j97abc123... morgan
  node scripts/mc-agent.js complete j97xyz789... morgan
    `);
  }
};

const [,, command, ...args] = process.argv;

if (!command || command === 'help') { commands.help(); process.exit(0); }
if (!commands[command]) { console.error(`Unknown command: ${command}`); commands.help(); process.exit(1); }

try {
  await commands[command](...args);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
