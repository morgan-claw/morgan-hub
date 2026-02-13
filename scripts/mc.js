#!/usr/bin/env node
/**
 * Mission Control CLI — Agents use this to interact with the shared task system.
 * 
 * Usage:
 *   node mc.js tasks                          — List all tasks
 *   node mc.js tasks --mine <agentId>         — List tasks assigned to me
 *   node mc.js tasks --status in_progress     — Filter by status
 *   node mc.js task:create <title> [--desc "..."] [--assign agent1,agent2] [--priority high]
 *   node mc.js task:update <taskId> --status in_progress
 *   node mc.js task:detail <taskId>           — Show task with thread
 *   node mc.js comment <taskId> <message>     — Post a comment on a task
 *   node mc.js feed [--limit 20]              — Show activity feed
 *   node mc.js mentions <agentId>             — Check for @mentions
 *   node mc.js notify <agentId> <message> [--taskId xxx]  — Create a notification
 *   node mc.js agents                         — List all agents
 *   node mc.js agent:status <agentId> <status> — Update agent status (active/idle/blocked)
 *   node mc.js submit --type <type> --agent <agentId> --content "..." [--target "..."]  — Submit content for approval
 *   node mc.js approvals [--status pending|approved|rejected|history]  — List approval items
 */

const http = require('http');
const API_BASE = 'http://localhost:3333/api';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = val;
    } else {
      positional.push(args[i]);
    }
  }
  return { flags, positional };
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const cmd = positional[0];

  if (!cmd) {
    console.log('Mission Control CLI. Commands: tasks, task:create, task:update, task:detail, comment, feed, mentions, notify, agents, agent:status, submit, approvals');
    return;
  }

  if (cmd === 'tasks') {
    let tasks = await api('GET', '/tasks');
    if (flags.mine) tasks = tasks.filter(t => t.assigneeIds.includes(flags.mine));
    if (flags.status) tasks = tasks.filter(t => t.status === flags.status);
    if (tasks.length === 0) { console.log('No tasks found.'); return; }
    const agents = await api('GET', '/agents');
    const agentMap = {};
    agents.forEach(a => agentMap[a.id] = a.name);
    for (const t of tasks) {
      const assignees = t.assigneeIds.map(id => agentMap[id] || id).join(', ');
      console.log(`[${t.status.toUpperCase()}] ${t.title}`);
      console.log(`  ID: ${t.id} | Priority: ${t.priority} | Assigned: ${assignees || 'none'}`);
      console.log(`  Created: ${timeAgo(t.createdAt)}${t.description ? '\n  ' + t.description.slice(0, 100) : ''}`);
      console.log('');
    }
    return;
  }

  if (cmd === 'task:create') {
    const title = positional[1];
    if (!title) { console.error('Usage: task:create <title> [--desc "..."] [--assign agent1,agent2] [--priority high]'); return; }
    const body = {
      title,
      description: flags.desc || '',
      priority: flags.priority || 'normal',
      assigneeIds: flags.assign ? flags.assign.split(',') : [],
      status: flags.assign ? 'assigned' : 'inbox',
      createdBy: flags.from || 'noah'
    };
    const task = await api('POST', '/tasks', body);
    console.log(`Created task: ${task.title} (${task.id})`);
    return;
  }

  if (cmd === 'task:update') {
    const id = positional[1];
    if (!id) { console.error('Usage: task:update <taskId> --status <status> [--assign agent1,agent2]'); return; }
    const body = { updatedBy: flags.from || 'system' };
    if (flags.status) body.status = flags.status;
    if (flags.assign) body.assigneeIds = flags.assign.split(',');
    if (flags.title) body.title = flags.title;
    if (flags.desc) body.description = flags.desc;
    if (flags.priority) body.priority = flags.priority;
    const task = await api('PATCH', '/tasks/' + id, body);
    console.log(`Updated task: ${task.title} → ${task.status}`);
    return;
  }

  if (cmd === 'task:detail') {
    const id = positional[1];
    if (!id) { console.error('Usage: task:detail <taskId>'); return; }
    const tasks = await api('GET', '/tasks');
    const task = tasks.find(t => t.id === id);
    if (!task) { console.error('Task not found'); return; }
    const agents = await api('GET', '/agents');
    const agentMap = {};
    agents.forEach(a => agentMap[a.id] = a.name);
    const msgs = await api('GET', '/messages?taskId=' + id);
    console.log(`=== ${task.title} ===`);
    console.log(`Status: ${task.status} | Priority: ${task.priority}`);
    console.log(`Assigned: ${task.assigneeIds.map(id => agentMap[id] || id).join(', ') || 'none'}`);
    if (task.description) console.log(`\n${task.description}`);
    if (msgs.length > 0) {
      console.log(`\n--- Thread (${msgs.length} messages) ---`);
      for (const m of msgs) {
        console.log(`[${agentMap[m.fromAgentId] || m.fromAgentId}] ${m.content} (${timeAgo(m.createdAt)})`);
      }
    }
    return;
  }

  if (cmd === 'comment') {
    const taskId = positional[1];
    const content = positional.slice(2).join(' ') || flags.msg;
    if (!taskId || !content) { console.error('Usage: comment <taskId> <message> [--from agentId]'); return; }
    await api('POST', '/messages', { taskId, content, fromAgentId: flags.from || 'system' });
    console.log('Comment posted.');
    return;
  }

  if (cmd === 'feed') {
    const limit = parseInt(flags.limit) || 20;
    const activities = await api('GET', '/activities');
    const agents = await api('GET', '/agents');
    const agentMap = {};
    agents.forEach(a => agentMap[a.id] = a.name);
    for (const a of activities.slice(0, limit)) {
      console.log(`[${timeAgo(a.createdAt)}] ${agentMap[a.agentId] || a.agentId}: ${a.message}`);
    }
    return;
  }

  if (cmd === 'mentions') {
    const agentId = positional[1];
    if (!agentId) { console.error('Usage: mentions <agentId>'); return; }
    const notifs = await api('GET', '/notifications?agentId=' + agentId);
    if (notifs.length === 0) { console.log('No unread mentions.'); return; }
    for (const n of notifs) {
      console.log(`[${timeAgo(n.createdAt)}] ${n.content}`);
    }
    return;
  }

  if (cmd === 'notify') {
    const agentId = positional[1];
    const content = positional.slice(2).join(' ');
    if (!agentId || !content) { console.error('Usage: notify <agentId> <message> [--taskId xxx]'); return; }
    await api('POST', '/notifications', { mentionedAgentId: agentId, content, taskId: flags.taskId });
    console.log('Notification created.');
    return;
  }

  if (cmd === 'agents') {
    const agents = await api('GET', '/agents');
    for (const a of agents) {
      console.log(`[${a.status.toUpperCase()}] ${a.name} (${a.role}) — ${a.sessionKey} [${a.level}]`);
    }
    return;
  }

  if (cmd === 'agent:status') {
    const id = positional[1];
    const status = positional[2];
    if (!id || !status) { console.error('Usage: agent:status <agentId> <active|idle|blocked>'); return; }
    await api('PATCH', '/agents/' + id, { status });
    console.log(`${id} → ${status}`);
    return;
  }

  if (cmd === 'submit') {
    const type = flags.type;
    const agentId = flags.agent;
    const content = flags.content;
    const target = flags.target || null;
    
    if (!type || !agentId || !content) {
      console.error('Usage: submit --type <tweet|linkedin|email|outreach|other> --agent <agentId> --content "..." [--target "..."]');
      return;
    }
    
    const body = { type, agentId, content, target };
    const item = await api('POST', '/approvals', body);
    console.log(`✓ Submitted ${type} for approval (ID: ${item.id})`);
    console.log(`Content: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`);
    return;
  }

  if (cmd === 'approvals') {
    const status = flags.status || 'pending';
    const items = await api('GET', '/approvals?status=' + status);
    
    if (items.length === 0) {
      console.log(`No ${status} approvals.`);
      return;
    }
    
    console.log(`=== ${status.toUpperCase()} APPROVALS (${items.length}) ===\n`);
    for (const item of items) {
      const statusSymbol = item.status === 'approved' ? '✓' : item.status === 'rejected' ? '✗' : '⏳';
      console.log(`${statusSymbol} [${item.type.toUpperCase()}] from ${item.agentId}`);
      console.log(`  ID: ${item.id}`);
      console.log(`  Content: ${item.content.slice(0, 120)}${item.content.length > 120 ? '...' : ''}`);
      if (item.target) console.log(`  Target: ${item.target}`);
      if (item.editedContent) console.log(`  Edited: ${item.editedContent.slice(0, 120)}...`);
      if (item.reason) console.log(`  Reason: ${item.reason}`);
      console.log(`  ${item.status === 'pending' ? 'Submitted' : 'Reviewed'}: ${timeAgo(item.reviewedAt || item.createdAt)}`);
      console.log('');
    }
    return;
  }

  console.error('Unknown command: ' + cmd);
}

main().catch(e => { console.error(e.message); process.exit(1); });
