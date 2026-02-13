#!/usr/bin/env node
/**
 * Mission Control Heartbeat Check
 * Agents use this for quick status checks during heartbeats
 * 
 * Usage:
 *   node mc-check.js <agentId>
 * 
 * Returns:
 *   - Tasks assigned to agent
 *   - Unread mentions/notifications
 *   - Pending approvals (global count for awareness)
 *   - Recent activity
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

async function main() {
  const agentId = process.argv[2];
  
  if (!agentId) {
    console.error('Usage: node mc-check.js <agentId>');
    process.exit(1);
  }

  try {
    // Parallel fetch
    const [tasks, notifications, approvals, activities] = await Promise.all([
      api('GET', '/tasks'),
      api('GET', '/notifications?agentId=' + agentId),
      api('GET', '/approvals?status=pending'),
      api('GET', '/activities')
    ]);

    // Filter tasks assigned to this agent
    const myTasks = tasks.filter(t => t.assigneeIds.includes(agentId));
    const urgentTasks = myTasks.filter(t => t.priority === 'high' && t.status !== 'done');
    const inProgressTasks = myTasks.filter(t => t.status === 'in_progress');
    
    // Count unread notifications
    const unread = notifications.filter(n => !n.delivered);
    
    // Recent activities (last 5)
    const recentActivity = activities.slice(0, 5);

    // Build output
    const output = {
      agent: agentId,
      timestamp: new Date().toISOString(),
      summary: {
        myTasks: myTasks.length,
        urgentTasks: urgentTasks.length,
        inProgress: inProgressTasks.length,
        notifications: unread.length,
        pendingApprovals: approvals.length
      },
      tasks: urgentTasks.length > 0 ? urgentTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority
      })) : [],
      notifications: unread.slice(0, 5).map(n => ({
        id: n.id,
        content: n.content,
        taskId: n.taskId
      })),
      recentActivity: recentActivity.map(a => ({
        agentId: a.agentId,
        message: a.message,
        createdAt: a.createdAt
      }))
    };

    console.log(JSON.stringify(output, null, 2));

    // Exit code: 0 = all clear, 1 = needs attention
    const needsAttention = urgentTasks.length > 0 || unread.length > 0 || approvals.length > 5;
    process.exit(needsAttention ? 1 : 0);

  } catch (e) {
    console.error('Error checking Mission Control:', e.message);
    process.exit(2);
  }
}

main();
