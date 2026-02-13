#!/usr/bin/env node
/**
 * Obsidian → Mission Control Sync
 * Scans vault for task files and creates them in Convex if they don't exist.
 * 
 * Usage: node scripts/mc-create-from-vault.js [--dry-run]
 */

import { ConvexHttpClient } from "../convex-backend/node_modules/convex/dist/esm/browser/index.js";
import fs from 'fs';
import path from 'path';

const CONVEX_URL = 'https://befitting-opossum-812.convex.cloud';
const VAULT_ROOT = 'C:\\Users\\openc\\Vault';
const client = new ConvexHttpClient(CONVEX_URL);
const dryRun = process.argv.includes('--dry-run');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w_]*)\s*:\s*(.+)/);
    if (m) {
      let val = m[2].trim();
      // Handle arrays
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        val = val.replace(/^["']|["']$/g, '');
      }
      fm[m[1]] = val;
    }
  }
  return fm;
}

function getTitle(content, filename) {
  const headingMatch = content.match(/^#\s+(.+)/m);
  if (headingMatch) return headingMatch[1].trim();
  return filename.replace(/\.md$/, '');
}

function scanDir(dir) {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      results.push(...scanDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  console.log(`${dryRun ? '🔍 DRY RUN — ' : ''}Scanning vault for tasks...\n`);
  
  const files = scanDir(VAULT_ROOT);
  const taskFiles = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    if (!fm) continue;
    
    // Check if it's a task with actionable status
    const tags = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);
    const isTask = tags.includes('task') || fm.type === 'task';
    const status = (fm.status || '').toLowerCase().replace(/\s+/g, '_');
    
    if (isTask && (status === 'to_do' || status === 'todo' || status === 'assigned')) {
      taskFiles.push({
        filePath,
        vaultPath: path.relative(VAULT_ROOT, filePath).replace(/\\/g, '/'),
        title: getTitle(content, path.basename(filePath)),
        status: status === 'assigned' ? 'assigned' : 'inbox',
        priority: fm.priority?.includes('1') ? 'high' : fm.priority?.includes('4') ? 'low' : 'normal',
        domain: fm.domain || undefined,
        tags: Array.isArray(fm.tags) ? fm.tags.filter(t => t !== 'task') : undefined,
        dueDate: fm.due_date || undefined,
        assignee: fm.assignee || 'morgan',
      });
    }
  }

  console.log(`Found ${taskFiles.length} vault tasks to sync.\n`);

  // Get existing tasks to avoid duplicates
  let existingTitles = new Set();
  try {
    const agents = ['morgan', 'atlas', 'forge', 'echo', 'haven', 'scout'];
    for (const agentId of agents) {
      const tasks = await client.query("tasks:getByAssignee", { agentId });
      tasks.forEach(t => existingTitles.add(t.title.toLowerCase()));
    }
  } catch (e) {
    console.warn('Warning: Could not fetch existing tasks:', e.message);
  }

  let created = 0;
  let skipped = 0;

  for (const task of taskFiles) {
    if (existingTitles.has(task.title.toLowerCase())) {
      console.log(`  ⏭️  Skip (exists): ${task.title}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  📝 Would create: ${task.title} [${task.status}] → ${task.vaultPath}`);
      created++;
      continue;
    }

    try {
      const id = await client.mutation("tasks:create", {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeIds: [task.assignee],
        createdBy: 'vault-sync',
        vaultPath: task.vaultPath,
        ...(task.domain && { domain: task.domain }),
        ...(task.dueDate && { dueDate: task.dueDate }),
        ...(task.tags?.length && { tags: task.tags }),
      });
      console.log(`  ✅ Created: ${task.title} → ${id}`);
      created++;
    } catch (e) {
      console.error(`  ❌ Failed: ${task.title} — ${e.message}`);
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
