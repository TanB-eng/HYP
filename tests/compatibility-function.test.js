const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const functionPath = path.join(root, 'supabase', 'functions', 'generate-compatibility', 'index.ts');
const sqlPath = path.join(root, 'supabase', 'sql', 'compatibility-ai-usage.sql');

test('compatibility AI function protects Gemini with login and daily usage limits', () => {
  const source = fs.readFileSync(functionPath, 'utf8');

  assert.match(source, /const DAILY_LIMIT = 3/);
  assert.match(source, /const CHAT_LIMIT = 3000/);
  assert.match(source, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.match(source, /Deno\.env\.get\("SUPABASE_ANON_KEY"\)/);
  assert.match(source, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /compatibility_ai_usage/);
  assert.match(source, /usedCount >= DAILY_LIMIT/);
  assert.match(source, /gemini-2\.5-flash/);
  assert.match(source, /generateContent/);
  assert.match(source, /Only successful Gemini responses consume usage/);
});

test('compatibility usage SQL creates a per-user daily usage table with RLS', () => {
  const source = fs.readFileSync(sqlPath, 'utf8');

  assert.match(source, /create table if not exists public\.compatibility_ai_usage/);
  assert.match(source, /user_id uuid not null references auth\.users/);
  assert.match(source, /usage_date date not null/);
  assert.match(source, /used_count integer not null default 0/);
  assert.match(source, /unique \(user_id, usage_date\)/);
  assert.match(source, /alter table public\.compatibility_ai_usage enable row level security/);
  assert.match(source, /auth\.uid\(\) = user_id/);
});
