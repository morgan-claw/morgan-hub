#!/usr/bin/env node
/**
 * habit-autocheck.js — Reads daily evidence and auto-checks habits
 * 
 * Sources:
 *   1. Obsidian daily note (journal text)
 *   2. Agent memory files (memory/YYYY-MM-DD.md)
 *   3. Hevy API (workout data)
 *   4. Git commit history (deep work evidence)
 *
 * Run: node scripts/habit-autocheck.js [YYYY-MM-DD]
 * Defaults to today. Outputs what it checked off.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../../data/vault.db');
const VAULT_DAILY = 'C:\\Users\\openc\\Vault\\05 Periodic\\Daily';
const AGENT_MEMORY = path.resolve(__dirname, '../../../memory');

// Date helpers
const targetDate = process.argv[2] || new Date().toISOString().slice(0, 10);
const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(targetDate + 'T12:00:00').getDay()];

console.log(`[habit-autocheck] Checking habits for ${targetDate} (${dayName})`);

// --- Load habits ---
const db = new DatabaseSync(DB_PATH);
const habits = db.prepare("SELECT * FROM habits WHERE active = 'true'").all();
const existingChecks = db.prepare(
  "SELECT habit_id FROM habit_checks WHERE date = ? AND completed = 1"
).all(targetDate);
const alreadyChecked = new Set(existingChecks.map(r => r.habit_id));

// --- Gather evidence ---
async function gatherEvidence() {
  const evidence = { texts: [], gym: false, commits: 0 };

  // 1. Obsidian daily note
  const dailyNotePath = path.join(VAULT_DAILY, `${targetDate}.md`);
  if (fs.existsSync(dailyNotePath)) {
    evidence.texts.push(fs.readFileSync(dailyNotePath, 'utf8'));
    console.log('  [source] Obsidian daily note found');
  }

  // 2. Agent memory
  const memPath = path.join(AGENT_MEMORY, `${targetDate}.md`);
  if (fs.existsSync(memPath)) {
    evidence.texts.push(fs.readFileSync(memPath, 'utf8'));
    console.log('  [source] Agent memory found');
  }

  // 3. Hevy workouts (via morgan-hub API if server running, else skip)
  try {
    const r = await fetch('http://localhost:3456/api/hevy/workouts?page=1&pageSize=5');
    if (r.ok) {
      const data = await r.json();
      const todayWorkouts = (data.workouts || []).filter(w => 
        w.start_time && w.start_time.startsWith(targetDate)
      );
      if (todayWorkouts.length > 0) {
        evidence.gym = true;
        evidence.texts.push('Completed gym workout: ' + todayWorkouts.map(w => w.title).join(', '));
        console.log(`  [source] Hevy: ${todayWorkouts.length} workout(s) found`);
      }
    }
  } catch { /* server not running, skip */ }

  // 4. Git commits today (evidence of deep work)
  try {
    const { execSync } = require('child_process');
    const commits = execSync(
      `git log --oneline --after="${targetDate}T00:00:00" --before="${targetDate}T23:59:59" --all 2>nul`,
      { cwd: 'C:\\Users\\openc\\.openclaw\\workspace', encoding: 'utf8', timeout: 5000 }
    ).trim();
    if (commits) {
      evidence.commits = commits.split('\n').length;
      evidence.texts.push('Git commits today:\n' + commits);
      console.log(`  [source] Git: ${evidence.commits} commit(s)`);
    }
  } catch { /* no git or error, skip */ }

  return evidence;
}

// --- Match evidence to habits ---
function matchHabits(evidence) {
  const fullText = evidence.texts.join('\n').toLowerCase();
  const matched = [];

  for (const habit of habits) {
    if (alreadyChecked.has(habit.id)) continue;

    // Check if due today
    try {
      const days = JSON.parse(habit.days || '[]');
      if (days.length && !days.includes(dayName)) continue;
    } catch { continue; }

    let found = false;
    const title = habit.title.toLowerCase();

    switch (habit.title) {
      case 'Gym':
        found = evidence.gym || /\bgym\b|workout|lifted|training|hevy/i.test(fullText);
        break;

      case 'Morning routine':
        // Evidence: mentions of waking up, morning activities, shower, breakfast
        found = /\bwoke up\b|morning routine|got up early|breakfast|shower|morning.*started/i.test(fullText);
        break;

      case 'Morning engagement':
        // Evidence: LinkedIn, Twitter, social media engagement, DMs, comments
        found = /\blinkedin\b|twitter|engagement|commented|posted|social media|dm[s']?\b|replied.*post/i.test(fullText);
        break;

      case 'Deep work block 1':
        // Evidence: significant work output in morning — commits, building, coding, research, writing
        found = evidence.commits >= 1 || 
          /\bdeep work\b|built|coded|implemented|shipped|worked on|research|writing.*morning|morning.*work/i.test(fullText);
        break;

      case 'Deep work block 2':
        // Evidence: significant work output in afternoon
        found = evidence.commits >= 3 ||
          /\bdeep work.*2\b|afternoon.*work|second.*block|continued.*work|pm.*worked|worked.*afternoon/i.test(fullText);
        break;

      case 'Groceries':
        found = /\bgrocer|grocery|bought food|food shopping|supermarket|no frills|loblaws|walmart.*food/i.test(fullText);
        break;

      case 'Laundry':
        found = /\blaundry|washed clothes|washing machine|dryer|folded clothes/i.test(fullText);
        break;

      case 'Meal prep':
        found = /\bmeal prep|prepped meals|cooked.*week|batch cook|food prep/i.test(fullText);
        break;

      case 'Cleaning':
        found = /\bcleaned|cleaning|vacuumed|mopped|tidied|wiped down|dishes/i.test(fullText);
        break;

      case 'Social reach-out':
        found = /\breach.*out|dm.*someone|messaged.*friend|coffee.*with|caught up with|reconnect/i.test(fullText);
        break;

      case 'Week planning':
        found = /\bweek.*plan|planning.*week|weekly.*review|set.*goals.*week|priorities.*week/i.test(fullText);
        break;

      default:
        // Generic: search for habit title in text
        found = fullText.includes(title);
    }

    if (found) matched.push(habit);
  }

  return matched;
}

// --- Check off habits ---
function checkOff(matched) {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO habit_checks 
     (type, habit_title, habit_id, date, completed, created_at, updated_at, sync_source)
     VALUES ('habit_check', ?, ?, ?, 1, datetime('now'), datetime('now'), 'auto')`
  );

  for (const h of matched) {
    insert.run(h.title, h.id, targetDate);
    console.log(`  [checked] ${h.title}`);
  }
}

// --- Main ---
(async () => {
  try {
    const evidence = await gatherEvidence();
    
    if (!evidence.texts.length && !evidence.gym && !evidence.commits) {
      console.log('  No evidence found for today. Nothing to check.');
      process.exit(0);
    }

    const matched = matchHabits(evidence);

    if (!matched.length) {
      console.log('  No new habits matched from evidence.');
    } else {
      checkOff(matched);
      console.log(`\n[habit-autocheck] Checked off ${matched.length} habit(s) for ${targetDate}`);
    }

    // Summary
    const totalChecked = db.prepare(
      "SELECT COUNT(*) as c FROM habit_checks WHERE date = ? AND completed = 1"
    ).get(targetDate);
    const totalDue = habits.filter(h => {
      try {
        const days = JSON.parse(h.days || '[]');
        return !days.length || days.includes(dayName);
      } catch { return false; }
    }).length;
    console.log(`[habit-autocheck] Total: ${totalChecked.c}/${totalDue} habits done for ${targetDate}`);
  } catch (e) {
    console.error('[habit-autocheck] Error:', e.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
