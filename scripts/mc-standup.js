#!/usr/bin/env node
/**
 * Mission Control Daily Standup Generator
 * Compiles activities, task status, and agent activity from the last 24h
 * into a summary. Designed to be called from an OpenClaw cron job.
 * 
 * Usage: node scripts/mc-standup.js
 * Output: Markdown summary to stdout (cron job captures and delivers)
 */

import { ConvexHttpClient } from "../convex-backend/node_modules/convex/dist/esm/browser/index.js";

const CONVEX_URL = 'https://befitting-opossum-812.convex.cloud';
const client = new ConvexHttpClient(CONVEX_URL);

const AGENT_NAMES = {
  morgan: 'Morgan',
  atlas: 'Atlas',
  forge: 'Forge',
  echo: 'Echo',
  haven: 'Haven',
  scout: 'Scout',
};

async function generateStandup() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);

  // Get all activities from last 24h
  const allActivities = await client.query("activities:list", {});
  const recentActivities = allActivities.filter(a => a.createdAt > oneDayAgo);

  // Get all tasks
  const allTasks = await client.query("tasks:list", {});
  const activeTasks = allTasks.filter(t => !['done', 'inbox'].includes(t.status));
  const completedToday = allTasks.filter(t => t.status === 'done' && t.updatedAt > oneDayAgo);
  const blockedTasks = allTasks.filter(t => t.status === 'blocked');

  // Group activities by agent
  const byAgent = {};
  for (const activity of recentActivities) {
    const name = AGENT_NAMES[activity.agentId] || activity.agentId;
    if (!byAgent[name]) byAgent[name] = [];
    byAgent[name].push(activity);
  }

  // Build summary
  const lines = [];
  lines.push('# Daily Standup');
  lines.push(`*${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}*`);
  lines.push('');

  // Task overview
  lines.push(`## Tasks: ${activeTasks.length} active, ${completedToday.length} completed today, ${blockedTasks.length} blocked`);
  lines.push('');

  if (completedToday.length > 0) {
    lines.push('### Completed');
    completedToday.forEach(t => lines.push(`- ~~${t.title}~~`));
    lines.push('');
  }

  if (blockedTasks.length > 0) {
    lines.push('### Blocked');
    blockedTasks.forEach(t => {
      const assignees = t.assigneeIds.map(id => AGENT_NAMES[id] || id).join(', ');
      lines.push(`- ${t.title} (${assignees})`);
    });
    lines.push('');
  }

  if (activeTasks.length > 0) {
    lines.push('### In Flight');
    activeTasks.filter(t => t.status !== 'blocked').forEach(t => {
      const assignees = t.assigneeIds.map(id => AGENT_NAMES[id] || id).join(', ');
      const priority = t.priority === 'high' ? '🔴' : '';
      lines.push(`- ${priority}${t.title} [${t.status}] → ${assignees}`);
    });
    lines.push('');
  }

  // Agent activity
  if (Object.keys(byAgent).length > 0) {
    lines.push('## Agent Activity (24h)');
    for (const [name, activities] of Object.entries(byAgent)) {
      lines.push(`\n**${name}** (${activities.length} actions)`);
      // Show last 5 activities per agent
      activities.slice(-5).forEach(a => {
        const time = new Date(a.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        lines.push(`- ${time}: ${a.message}`);
      });
    }
  } else {
    lines.push('## Agent Activity (24h)\nNo activity logged.');
  }

  return lines.join('\n');
}

try {
  const summary = await generateStandup();
  console.log(summary);
} catch (err) {
  console.error('Error generating standup:', err.message);
  process.exit(1);
}
