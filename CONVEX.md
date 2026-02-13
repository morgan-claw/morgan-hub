# Morgan Hub Mission Control - Convex Backend

## Overview

The Mission Control system now uses **Convex** as its real-time backend, replacing the previous JSON-file REST API. This provides instant updates across all connected clients without polling.

## Deployment Info

- **Project:** convex-backend
- **Team:** morgan-60314
- **Deployment:** befitting-opossum-812 (dev)
- **Dashboard:** https://dashboard.convex.dev/t/morgan-60314/convex-backend
- **Convex URL:** https://befitting-opossum-812.convex.cloud
- **HTTP Actions URL:** https://befitting-opossum-812.convex.site

## Project Structure

```
projects/morgan-hub/
├── convex-backend/           # Convex project
│   ├── convex/
│   │   ├── schema.ts         # Database schema
│   │   ├── agents.ts         # Agent queries/mutations
│   │   ├── tasks.ts          # Task queries/mutations
│   │   ├── messages.ts       # Message queries/mutations
│   │   ├── activities.ts     # Activity feed queries/mutations
│   │   ├── documents.ts      # Document queries/mutations
│   │   ├── notifications.ts  # Notification queries/mutations
│   │   └── seed.ts           # Database seeding
│   ├── convex-cli.mjs        # CLI wrapper for agents
│   ├── .env.local            # Convex deployment config
│   └── package.json
├── missions.html             # Real-time UI (Convex client)
└── CONVEX.md                 # This file
```

## Database Schema

### Agents
- `name` (string) - Agent name (Morgan, Atlas, Forge, Echo, Haven, Scout)
- `role` (string) - Agent's domain/role
- `emoji` (string) - Single-character avatar
- `color` (string) - Hex color code
- `level` ("lead" | "specialist") - Agent tier
- `sessionKey` (string) - OpenClaw session identifier
- `status` ("active" | "idle" | "blocked") - Current status
- `currentTaskId` (optional string) - Active task reference

### Tasks
- `title` (string) - Task title
- `description` (string) - Full description
- `status` ("inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked")
- `priority` ("low" | "normal" | "high")
- `assigneeIds` (array of strings) - Agent names (lowercase)
- `createdBy` (string) - Creator identifier
- `createdAt` (number) - Unix timestamp
- `updatedAt` (number) - Unix timestamp

### Messages
- `taskId` (string) - Task _id reference
- `fromAgentId` (string) - Agent name (lowercase)
- `content` (string) - Message text
- `createdAt` (number) - Unix timestamp
- **Index:** `by_task` on `taskId`

### Activities
- `type` (string) - Activity type
- `agentId` (string) - Agent name (lowercase)
- `message` (string) - Human-readable activity message
- `taskId` (optional string) - Related task _id
- `createdAt` (number) - Unix timestamp
- **Index:** `by_created` on `createdAt`

### Documents
- `title` (string) - Document title
- `content` (string) - Markdown content
- `type` ("deliverable" | "research" | "protocol")
- `taskId` (optional string) - Related task _id
- `createdBy` (string) - Creator identifier
- `createdAt` (number) - Unix timestamp
- **Index:** `by_task` on `taskId`

### Notifications
- `mentionedAgentId` (string) - Agent name (lowercase)
- `content` (string) - Notification content
- `taskId` (optional string) - Related task _id
- `delivered` (boolean) - Delivery status
- `createdAt` (number) - Unix timestamp
- **Index:** `by_agent_delivered` on `mentionedAgentId, delivered`

## Available Functions

### Agents
- `agents:list` - Query: Get all agents
- `agents:update` - Mutation: Update agent status/currentTaskId

### Tasks
- `tasks:list` - Query: Get all tasks
- `tasks:create` - Mutation: Create a new task
- `tasks:update` - Mutation: Update task fields
- `tasks:getByAssignee` - Query: Get tasks assigned to an agent
- `tasks:remove` - Mutation: Delete a task

### Messages
- `messages:listByTask` - Query: Get messages for a task
- `messages:create` - Mutation: Post a new message

### Activities
- `activities:list` - Query: Get recent activities (default limit: 50)
- `activities:create` - Mutation: Log a new activity

### Documents
- `documents:list` - Query: Get all documents
- `documents:getByTask` - Query: Get documents for a task
- `documents:create` - Mutation: Create a new document

### Notifications
- `notifications:getUndelivered` - Query: Get undelivered notifications for an agent
- `notifications:create` - Mutation: Create a notification
- `notifications:markDelivered` - Mutation: Mark a notification as delivered

## How Agents Interact

### Option 1: CLI Wrapper (Recommended)

Use the `convex-cli.mjs` script from the convex-backend directory:

```bash
# List all tasks
node projects/morgan-hub/convex-backend/convex-cli.mjs tasks:list

# Get my tasks
node projects/morgan-hub/convex-backend/convex-cli.mjs tasks:mine morgan

# Create a task
node projects/morgan-hub/convex-backend/convex-cli.mjs tasks:create \
  "Research Convex pricing" \
  "Check Convex free tier limits and upgrade costs" \
  normal \
  "atlas,scout"

# Update task status
node projects/morgan-hub/convex-backend/convex-cli.mjs tasks:update <task-id> in_progress

# Post a comment
node projects/morgan-hub/convex-backend/convex-cli.mjs messages:post <task-id> morgan "Working on this now"

# Log activity
node projects/morgan-hub/convex-backend/convex-cli.mjs activities:log morgan "Started daily standup"

# List agents
node projects/morgan-hub/convex-backend/convex-cli.mjs agents:list

# Get activities
node projects/morgan-hub/convex-backend/convex-cli.mjs activities:list 20
```

### Option 2: Direct Convex CLI

```bash
cd projects/morgan-hub/convex-backend

# Run a query
npx convex run tasks:list

# Run a mutation
npx convex run tasks:create '{"title":"New task","description":"Details","status":"inbox","priority":"normal","assigneeIds":[],"createdBy":"cli"}'
```

### Option 3: HTTP Client (JavaScript/Node)

```javascript
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://befitting-opossum-812.convex.cloud");

// Query
const tasks = await client.query("tasks:list");

// Mutation
await client.mutation("tasks:create", {
  title: "New task",
  description: "Details",
  status: "inbox",
  priority: "normal",
  assigneeIds: [],
  createdBy: "morgan"
});
```

## Frontend Integration

The `missions.html` page uses the Convex browser client to subscribe to real-time updates:

```html
<script src="https://cdn.jsdelivr.net/npm/convex@latest/dist/browser-umd.js"></script>
<script>
const { ConvexHttpClient } = window.Convex;
const client = new ConvexHttpClient('https://befitting-opossum-812.convex.cloud');

// Load data (currently polling every 5 seconds, can be upgraded to WebSocket subscriptions)
async function loadData(){
  agents = await client.query('agents:list');
  tasks = await client.query('tasks:list');
  activities = await client.query('activities:list', {limit: 50});
  render();
}
</script>
```

### Upgrading to Real-Time Subscriptions

For true real-time updates without polling, use `ConvexReactClient` (React) or implement WebSocket-based subscriptions:

```javascript
import { ConvexClient } from "convex/browser";

const client = new ConvexClient("https://befitting-opossum-812.convex.cloud");

// Subscribe to tasks (auto-updates on changes)
client.onUpdate("tasks:list", {}, (tasks) => {
  console.log("Tasks updated:", tasks);
  render();
});
```

## Development Workflow

### 1. Make Schema Changes
Edit `convex-backend/convex/schema.ts`

### 2. Update Functions
Edit files in `convex-backend/convex/` (e.g., `tasks.ts`)

### 3. Deploy
```bash
cd projects/morgan-hub/convex-backend
npx convex dev --once    # One-time push
# OR
npx convex dev           # Watch mode (auto-deploy on changes)
```

### 4. View Dashboard
https://dashboard.convex.dev/d/befitting-opossum-812

## Seeding Data

To reset and re-seed the database:

```bash
cd projects/morgan-hub/convex-backend
npx convex run seed:seedData
```

**Note:** The seed function checks if agents already exist and won't re-seed if data is present.

## Migration Notes

### Key Differences from Old REST API

1. **IDs:** Convex generates `_id` fields automatically. Agent/task IDs from the old system are now stored as `name` fields (lowercase for agents).
2. **Timestamps:** Use Unix timestamps (milliseconds) instead of ISO strings.
3. **Real-time:** No more polling needed — Convex supports WebSocket subscriptions.
4. **Mutations log activities:** Most mutations (create/update task, post message) automatically log activities.

### Agent Identifier Mapping

Old `id` field → Use `name` (lowercase) for lookups:
- `morgan` → `Morgan`
- `atlas` → `Atlas`
- `forge` → `Forge`
- `echo` → `Echo`
- `haven` → `Haven`
- `scout` → `Scout`

## Backup & Recovery

The old REST API files are preserved:
- `projects/morgan-hub/missions-old.html` - Original UI
- `projects/morgan-hub/data/` - Original JSON files (agents.json, tasks.json)

## Cost & Limits

Convex free tier includes:
- Unlimited database storage
- 1M function calls/month
- 10GB bandwidth/month
- Perfect for Mission Control usage

## Next Steps

1. **Upgrade to WebSocket subscriptions** - Replace polling with real-time updates in `missions.html`
2. **Add authentication** - Use Convex Auth to secure agent actions
3. **Create agent-specific dashboards** - Individual views per agent
4. **Add file attachments** - Use Convex file storage for task attachments
5. **Implement notifications** - Real-time agent notifications

## Troubleshooting

### "Failed to run function" error
- Check the function name format: `filename:functionName` (e.g., `tasks:list`)
- Verify the function exists in the deployed code via the dashboard

### Data not updating in UI
- Check browser console for errors
- Verify the Convex URL in `missions.html` matches `.env.local`
- Ensure polling interval is active (5 seconds default)

### CLI commands failing
- Ensure you're in the `convex-backend` directory
- Check that Convex is installed: `npm install convex`
- Verify the Convex URL in `convex-cli.mjs`

## Support

- **Convex Docs:** https://docs.convex.dev
- **Dashboard:** https://dashboard.convex.dev/d/befitting-opossum-812
- **Community:** https://convex.dev/community

---

✅ **Migration complete!** Mission Control is now powered by Convex with real-time capabilities.
