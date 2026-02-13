# Mission Control Agent Integration

## Overview

The OpenClaw agent team is now fully wired into Mission Control (Convex backend). Agents can check their tasks, pick up work, update status, and log activities.

## Components

### 1. Heartbeat Script (`scripts/mc-heartbeat.js`)

Quick status check for periodic heartbeat polls.

**Usage:**
```bash
cd projects/morgan-hub
node scripts/mc-heartbeat.js <agentName>
```

**Exit Codes:**
- `0` - Nothing needs attention (HEARTBEAT_OK)
- `1` - Action required (assigned tasks, urgent tasks)
- `2` - Error connecting to MC

**Output:**
```json
{
  "agent": "morgan",
  "timestamp": "2026-02-12T22:16:54.884Z",
  "counts": {
    "assigned": 0,
    "inProgress": 1,
    "urgent": 1
  },
  "inProgress": [
    {
      "id": "js705rpnj9rmfx836jy5y7sr6x81077w",
      "title": "Morgan Hub — Mission Control system",
      "priority": "high"
    }
  ]
}
```

### 2. Agent CLI (`scripts/mc-agent.js`)

Full-featured CLI for task management.

**Commands:**

```bash
cd projects/morgan-hub

# View all tasks
node scripts/mc-agent.js status <agentId>

# Pick up a task (move to in_progress)
node scripts/mc-agent.js pickup <taskId> <agentId>

# Update task status
node scripts/mc-agent.js update <taskId> <status> <agentId>

# Add a comment
node scripts/mc-agent.js comment <taskId> <agentId> <message>

# Complete a task
node scripts/mc-agent.js complete <taskId> <agentId>

# Log an activity
node scripts/mc-agent.js log <agentId> <message> [taskId]
```

**Status values:** inbox, assigned, in_progress, blocked, review, done

### 3. HEARTBEAT.md Integration

The main agent's `HEARTBEAT.md` file now includes Mission Control checks:

1. **Check MC status** - Run heartbeat script to see assigned/in-progress tasks
2. **Handle assigned tasks** - Pick up tasks that are ready to work on
3. **Update in-progress tasks** - Log progress, mark blocked, or complete
4. **Report back** - Include brief MC summary in heartbeat response

## Testing Results

✅ **mc-heartbeat.js**
- Morgan: 1 in-progress task, 1 urgent task (exit code 1)
- Atlas: 1 assigned task (exit code 1)

✅ **mc-agent.js status**
- Morgan: Shows 1 in-progress, 2 done tasks
- Atlas: Shows 1 assigned task

✅ **mc-agent.js pickup**
- Moved Atlas's task from assigned → in_progress
- Activity logged in feed

✅ **mc-agent.js comment**
- Added comment to task
- Activity logged in feed

✅ **mc-agent.js log**
- Custom activity logged with taskId
- Visible in activity feed

✅ **mc-agent.js update**
- Updated task status back to assigned
- Activity logged in feed

## Activity Feed Verification

All agent actions are being logged to the Convex activity feed:

```json
{
  "agentId": "atlas",
  "message": "Testing Mission Control integration",
  "taskId": "js71dss47g4zvdbn2sv7r9es9h8108x4",
  "type": "agent_action"
}
```

## Architecture

**Backend:** Convex deployment at `befitting-opossum-812.convex.cloud`

**Client Library:** ConvexHttpClient from `convex/browser`

**Scripts Location:** `projects/morgan-hub/scripts/`

**Dependencies:** Uses node_modules from `projects/morgan-hub/convex-backend/`

**Agents:** morgan, atlas, forge, echo, haven

## Next Steps

1. ✅ Agents now check MC during heartbeats
2. ✅ Agents can pick up and complete tasks programmatically
3. ✅ All actions are logged to the activity feed
4. Future: Add notifications, mentions, and cross-agent coordination

## Usage Examples

**Morgan's heartbeat routine:**
```bash
cd projects/morgan-hub; node scripts/mc-heartbeat.js morgan
```

If exit code is 1, check what needs attention and respond with summary:
```
MC: 1 in-progress task (Morgan Hub - Mission Control)
```

**Atlas picking up work:**
```bash
cd projects/morgan-hub
node scripts/mc-agent.js status atlas
node scripts/mc-agent.js pickup js71dss47g4zvdbn2sv7r9es9h8108x4 atlas
node scripts/mc-agent.js log atlas "Started building LinkedIn segments"
```

**Completing a task:**
```bash
cd projects/morgan-hub
node scripts/mc-agent.js complete js705rpnj9rmfx836jy5y7sr6x81077w morgan
node scripts/mc-agent.js log morgan "Mission Control integration complete!"
```
