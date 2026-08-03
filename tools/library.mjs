#!/usr/bin/env node
// Asset library: one JSON index over reusable production assets (music, sfx,
// voices, clips, stills, prompt/style locks). REUSE BEFORE REGENERATING -
// search here first; every generated keeper gets registered.
//
//   node tools/library.mjs list [type]
//   node tools/library.mjs search <term>          (matches type, tags, note, path)
//   node tools/library.mjs add <file-or-dir> --type music|sfx|voice|clip|still|prompt \
//        --tags a,b --note "what and when to reuse it"
//
// Index: marketing/production/library/index.json. Entries point at files
// where they already live in the repo - nothing is copied or moved.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve, relative} from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'marketing/production/library/index.json');
const load = () => (existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : []);
const save = (db) => writeFileSync(INDEX, JSON.stringify(db, null, 1));
const show = (e) => console.log(`[${e.type}] ${e.path}\n   tags: ${e.tags.join(', ')} | ${e.date}\n   ${e.note}`);

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : null;
};

if (cmd === 'list') {
  const db = load().filter((e) => !rest[0] || rest[0].startsWith('--') || e.type === rest[0]);
  db.forEach(show);
  console.log(`\n${db.length} assets`);
} else if (cmd === 'search') {
  const q = rest.filter((r) => !r.startsWith('--')).join(' ').toLowerCase();
  const db = load().filter((e) => [e.type, e.path, e.note, ...e.tags].join(' ').toLowerCase().includes(q));
  db.forEach(show);
  console.log(`\n${db.length} matches for "${q}"`);
} else if (cmd === 'add') {
  const file = rest[0];
  const type = opt('type');
  if (!file || !type) {
    console.error('add needs <file> --type <type> [--tags a,b] [--note "..."]');
    process.exit(1);
  }
  const path = relative(ROOT, resolve(file));
  const db = load().filter((e) => e.path !== path);
  db.push({type, path, tags: (opt('tags') || '').split(',').filter(Boolean),
    note: opt('note') || '', date: new Date().toISOString().slice(0, 10)});
  save(db);
  console.log(`registered [${type}] ${path} (${db.length} total)`);
} else {
  console.error('Usage: library.mjs list [type] | search <term> | add <file> --type t --tags a,b --note "..."');
  process.exit(1);
}
