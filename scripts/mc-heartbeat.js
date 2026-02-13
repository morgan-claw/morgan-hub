#!/usr/bin/env node
/**
 * Mission Control Heartbeat Check
 * Quick status check for agents during heartbeat polls
 * 
 * Usage: node scripts/mc-heartbeat.js <agentName>
 * Exit codes: 0 = all clear, 1 = action required, 2 = error
 */

import { ConvexHttpClient } from "../convex-backend/node_modules/convex/dist/esm/browser/index.js";

const CONVEX_URL = 'https://befitting-opossum-812.convex.cloud';
const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  const agentName = process.argv[2];
  if (!agentName) { console.error('Usage: node scripts/mc-heartbeat.js <agentName>'); process.exit(1); }

  const agentId = agentName.toLowerCase();

  try {
    const tasks = await client.query("tasks:getByAssignee", { agentId });
    
    const assigned = tasks.filter(t => t.status === 'assigned');
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const urgent = tasks.filter(t => t.priority === 'high' && t.status !== 'done');
    
    // Check for overdue tasks
    const now = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'archived');

    // Get recent activities
    let recentActivities = [];
    try {
      recentActivities = await client.query("activities:getRecent", { agentId, limit: 3 });
    } catch { /* activities query may not exist yet */ }

    // Print clean summary
    console.log(`\n🎯 MC Heartbeat — ${agentName} (${new Date().toLocaleTimeString()})\n`);
    console.log(`  📥 Assigned: ${assigned.length}  |  🔄 In Progress: ${inProgress.length}  |  🔴 Urgent: ${urgent.length}  |  ⏰ Overdue: ${overdue.length}`);
    
    if (assigned.length > 0) {
      console.log(`\n  📥 ASSIGNED:`);
      assigned.slice(0, 3).forEach(t => {
        const p = t.priority === 'high' ? '🔴' : t.priority === 'normal' ? '🟡' : '⚪';
        console.log(`    ${p} ${t.title} [${t._id}]`);
      });
    }

    if (overdue.length > 0) {
      console.log(`\n  ⏰ OVERDUE:`);
      overdue.forEach(t => {
        console.log(`    ⚠️  ${t.title} (due ${t.dueDate}) [${t._id}]`);
      });
    }

    if (recentActivities.length > 0) {
      console.log(`\n  📝 RECENT ACTIVITY:`);
      recentActivities.forEach(a => {
        const time = new Date(a._creationTime).toLocaleTimeString();
        console.log(`    ${time} — ${a.message}`);
      });
    }

    console.log();

    const needsAttention = assigned.length > 0 || urgent.length > 0 || overdue.length > 0;
    process.exit(needsAttention ? 1 : 0);

  } catch (error) {
    console.error('Error checking Mission Control:', error.message);
    process.exit(2);
  }
}

main();
