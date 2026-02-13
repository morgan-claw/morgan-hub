#!/usr/bin/env node
/**
 * Mission Control Notification Daemon
 * Polls Convex for undelivered notifications and routes them to agents via OpenClaw.
 * 
 * Usage: node scripts/mc-notify.js
 * Runs continuously, polling every 5 seconds.
 * 
 * Notifications are delivered via OpenClaw's sessions_send to the target agent's session.
 * After delivery, notifications are marked as delivered in Convex.
 */

import { ConvexHttpClient } from "../convex-backend/node_modules/convex/dist/esm/browser/index.js";
import fs from 'fs';

const CONVEX_URL = 'https://befitting-opossum-812.convex.cloud';
const client = new ConvexHttpClient(CONVEX_URL);

// Agent ID → OpenClaw Slack session key (lowercase channel IDs)
const AGENT_SESSIONS = {
  morgan: 'agent:main:slack:channel:c0aecgm60ue',  // #hub
  atlas:  'agent:main:slack:channel:c0ae86uqujx',  // #ops
  forge:  'agent:main:slack:channel:c0aecgmhv62',  // #build
  echo:   'agent:main:slack:channel:c0aeejdpcje',  // #content
  haven:  'agent:main:slack:channel:c0aej6strha',  // #life
  scout:  null,  // no dedicated channel
};

const POLL_INTERVAL = 5000; // 5 seconds

// Read gateway config for auth
function getGatewayAuth() {
  const config = JSON.parse(fs.readFileSync('C:\\Users\\openc\\.openclaw\\openclaw.json', 'utf8'));
  const port = config.gateway?.port || 18789;
  const authMode = config.gateway?.auth?.mode || 'token';
  const token = authMode === 'password'
    ? (config.gateway?.auth?.password || '')
    : (config.gateway?.auth?.token || '');
  return { port, token };
}

async function deliverNotification(notification) {
  const sessionKey = AGENT_SESSIONS[notification.mentionedAgentId];
  if (!sessionKey) {
    console.warn(`Unknown agent: ${notification.mentionedAgentId}, skipping`);
    return false;
  }

  try {
    const { port, token } = getGatewayAuth();
    const message = `📬 MC Notification: ${notification.content}${notification.taskId ? ` (Task: ${notification.taskId})` : ''}`;
    
    const response = await fetch(`http://127.0.0.1:${port}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        tool: 'sessions_send',
        args: { sessionKey, message },
      }),
    });

    if (!response.ok) {
      console.error(`Failed to deliver to ${notification.mentionedAgentId}: ${response.status}`);
      return false;
    }

    // Mark as delivered in Convex
    await client.mutation("notifications:markDelivered", { id: notification._id });
    console.log(`✅ Delivered to ${notification.mentionedAgentId}: ${notification.content.substring(0, 60)}`);
    return true;
  } catch (err) {
    console.error(`Error delivering to ${notification.mentionedAgentId}:`, err.message);
    return false;
  }
}

async function pollOnce() {
  const agents = Object.keys(AGENT_SESSIONS);
  let totalDelivered = 0;

  for (const agentId of agents) {
    try {
      const notifications = await client.query("notifications:getUndelivered", { agentId });
      for (const notif of notifications) {
        const delivered = await deliverNotification(notif);
        if (delivered) totalDelivered++;
      }
    } catch (err) {
      // Silently skip on query errors
    }
  }

  return totalDelivered;
}

async function main() {
  console.log('🔔 MC Notification Daemon started');
  console.log(`   Polling every ${POLL_INTERVAL / 1000}s`);
  console.log(`   Agents: ${Object.keys(AGENT_SESSIONS).join(', ')}`);
  console.log('');

  // One-shot mode if --once flag
  if (process.argv.includes('--once')) {
    const count = await pollOnce();
    console.log(`Delivered ${count} notification(s)`);
    process.exit(0);
  }

  // Continuous polling
  while (true) {
    await pollOnce();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
