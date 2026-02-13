# Approval Queue — Tinder-Style Content Review

## What This Is

A card-based approval system where Noah can swipe through agent-generated content (tweets, LinkedIn posts, emails, outreach messages) and approve/reject them with gestures — just like Tinder.

No more digging through Slack threads. Just swipe.

## How It Works

### For Noah

**Access:** http://localhost:3333/approvals.html

**Controls:**
- **Swipe Right** or **→ key** = Approve ✓
- **Swipe Left** or **← key** = Reject ✗
- **Swipe Up** or **↑ key** = Edit before approving
- **Mouse/Touch Drag** = Visual feedback with rotation and hints

**Features:**
- Cards show agent, content type, draft text, target, and timestamp
- Stack of 3 cards visible at once (next cards peek behind)
- Empty state when queue is clear: "All caught up 👍"
- History tab to see approved/rejected items
- Badge on sidebar shows pending count

### For Agents

**Submit content for approval:**
```bash
node scripts/mc.js submit \
  --type tweet \
  --agent echo \
  --content "Your tweet text here" \
  --target "@proclawed"
```

**Types:** `tweet`, `linkedin`, `email`, `outreach`, `other`

**Check approval queue:**
```bash
node scripts/mc.js approvals
node scripts/mc.js approvals --status approved
node scripts/mc.js approvals --status rejected
node scripts/mc.js approvals --status history
```

**Heartbeat check (includes pending count):**
```bash
node scripts/mc-check.js echo
```

Returns JSON with:
- Tasks assigned to agent
- Unread notifications
- **Pending approvals count** (global awareness)
- Recent activity

## API Endpoints

All endpoints at `http://localhost:3333/api/approvals`

### `GET /api/approvals?status=pending`
List approval items. Status: `pending` (default), `approved`, `rejected`, or `history` (all processed).

### `POST /api/approvals`
Submit new item for approval.
```json
{
  "type": "tweet|linkedin|email|outreach|other",
  "agentId": "echo",
  "content": "Draft content...",
  "target": "@proclawed (optional)"
}
```

### `PATCH /api/approvals/:id`
Approve, reject, or edit an item.
```json
{
  "status": "approved|rejected",
  "reason": "Optional reason for rejection",
  "editedContent": "Optional edited version (for approve)"
}
```

### `DELETE /api/approvals/:id`
Delete an approval item.

## Data Schema

Each approval item in `data/approvals.json`:
```json
{
  "id": "abc123def456",
  "type": "tweet",
  "agentId": "echo",
  "content": "Original draft text",
  "target": "@proclawed",
  "status": "pending",
  "reason": null,
  "editedContent": null,
  "createdAt": "2026-02-12T19:30:00.000Z",
  "reviewedAt": null
}
```

## Integration

### Missions.html Sidebar
- Added "Approvals" nav link with checkmark icon
- Badge shows pending count (updates every 10s)
- Badge only visible when count > 0

### CLI Tools
- `mc.js submit` — agents submit content
- `mc.js approvals` — view/filter approval items
- `mc-check.js` — heartbeat check includes pending count

## Design

- **Dark theme** — matches Morgan Hub aesthetic (var(--bg), var(--accent), etc.)
- **Tactile feel** — cards rotate slightly on drag, smooth animations
- **Mobile-first** — works great on iPhone/Android
- **60fps animations** — CSS `will-change: transform` for smooth performance
- **Visual feedback** — green/red hints appear as you drag, flash on swipe
- **Keyboard shortcuts** — arrows for quick desktop workflow

## Physics

Swipe detection:
- Threshold: 120px horizontal movement
- Up threshold: -100px vertical movement
- Rotation: 0.1× drag distance
- Opacity fade based on swipe progress

Animation timing:
- Card exit: 300ms cubic-bezier
- Background cards: scale + translateY for depth effect
- Smooth transitions when not dragging

## Testing

**Populate with sample data:**
```bash
node scripts/test-approvals.js
```

This adds 5 sample items (tweets, LinkedIn, email, outreach) so you can test the swipe interface immediately.

**Manual test:**
```bash
# Submit a test tweet
node scripts/mc.js submit --type tweet --agent echo --content "Test tweet!" --target "@proclawed"

# View the queue
node scripts/mc.js approvals

# Open the UI
# http://localhost:3333/approvals.html
```

## Future Enhancements

- [ ] **Auto-dispatch** — when approved, actually post/send (integrate with Twitter API, Gmail, etc.)
- [ ] **Undo** — quick undo button after swipe (5s window)
- [ ] **Scheduling** — swipe up to schedule for later instead of immediate approve
- [ ] **Batch actions** — approve all from specific agent
- [ ] **Filters** — filter queue by type or agent
- [ ] **Push notifications** — notify Noah when queue grows (mobile)
- [ ] **Voice notes** — attach voice feedback on rejection
- [ ] **Analytics** — approval rate by agent, average review time

## Architecture Notes

- **Vanilla JS** — no React/Vue, keeps it simple and fast
- **REST API** — simple HTTP endpoints, easy to extend
- **JSON file storage** — `data/approvals.json`, easy to inspect/backup
- **Polling** — 10s refresh interval (can upgrade to WebSocket later)
- **Touch + Mouse + Keyboard** — all input methods supported
- **Progressive enhancement** — works without JS (well, mostly)

---

Built by Morgan (with a little help from Noah) 🚀
