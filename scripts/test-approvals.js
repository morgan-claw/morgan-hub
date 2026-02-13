#!/usr/bin/env node
/**
 * Test script to populate the approval queue with sample data
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

const SAMPLES = [
  {
    type: 'tweet',
    agentId: 'echo',
    content: 'Just shipped a major update to ProClawed 🚀\n\nNew features:\n• Tinder-style approval queue\n• Swipe gestures for content review\n• Real-time agent coordination\n\nBuilding in public. What should we add next?',
    target: '@proclawed'
  },
  {
    type: 'linkedin',
    agentId: 'echo',
    content: 'Excited to share that we\'re building a new approach to AI agent coordination.\n\nInstead of managing agents through complex dashboards, we\'re making it as simple as swiping through a deck of cards.\n\nApprove with a swipe right. Reject with a swipe left. Edit with a swipe up.\n\nMaking AI agents feel more human, one swipe at a time.',
    target: 'Noah\'s LinkedIn'
  },
  {
    type: 'email',
    agentId: 'atlas',
    content: 'Subject: Re: Partnership Opportunity\n\nHi Sarah,\n\nThanks for reaching out about the collaboration.\n\nI\'d love to explore how ProClawed could integrate with your platform. Our agent orchestration system could be a great fit for your automation workflows.\n\nAre you available for a call next week?\n\nBest,\nNoah',
    target: 'sarah@example.com'
  },
  {
    type: 'outreach',
    agentId: 'echo',
    content: 'Hey @naval 👋\n\nBuilding something you might find interesting — AI agents that coordinate like a team, not just a set of tools.\n\nThink: mission control dashboard + Tinder swipes for approval workflows.\n\nWould love your thoughts if you have 2 minutes.',
    target: '@naval'
  },
  {
    type: 'tweet',
    agentId: 'echo',
    content: 'Hot take: AI agents shouldn\'t feel like debugging production.\n\nThey should feel like working with a great team.\n\nClear communication. Trust. Quick feedback loops.\n\nWe\'re building that at @proclawed.',
    target: '@proclawed'
  }
];

async function main() {
  console.log('Populating approval queue with sample data...\n');
  
  for (const sample of SAMPLES) {
    try {
      const result = await api('POST', '/approvals', sample);
      console.log(`✓ Added ${sample.type} from ${sample.agentId} (ID: ${result.id})`);
    } catch (e) {
      console.error(`✗ Failed to add ${sample.type}:`, e.message);
    }
  }
  
  console.log(`\n✓ Added ${SAMPLES.length} items to approval queue`);
  console.log('\nVisit http://localhost:3333/approvals.html to review them!');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
