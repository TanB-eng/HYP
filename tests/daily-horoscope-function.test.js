const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const functionPath = path.join(root, 'supabase', 'functions', 'sync-daily-horoscopes', 'index.ts');

test('sync daily horoscopes function is configured for cached public daily content', () => {
  const source = fs.readFileSync(functionPath, 'utf8');

  [
    'aries',
    'taurus',
    'gemini',
    'cancer',
    'leo',
    'virgo',
    'libra',
    'scorpio',
    'sagittarius',
    'capricorn',
    'aquarius',
    'pisces',
  ].forEach((sign) => {
    assert.match(source, new RegExp(`"${sign}"`));
  });

  assert.match(source, /Deno\.env\.get\("FREE_ASTRO_API_KEY"\)/);
  assert.match(source, /Deno\.env\.get\("TENCENT_SECRET_ID"\)/);
  assert.match(source, /Deno\.env\.get\("TENCENT_SECRET_KEY"\)/);
  assert.match(source, /Deno\.env\.get\("CRON_SECRET"\)/);
  assert.match(source, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(source, /Unauthorized/);
  assert.match(source, /x-cron-secret/);
  assert.match(source, /"x-api-key": freeAstroKey/);
  assert.match(source, /tmt\.tencentcloudapi\.com/);
  assert.match(source, /TC3-HMAC-SHA256/);
  assert.match(source, /TextTranslate/);
  assert.match(source, /content_text_zh/);
  assert.match(source, /debug=1/);
  assert.match(source, /translation/);
  assert.match(source, /await delay\(1100\)/);
  assert.match(source, /api\.freeastroapi\.com\/api\/v2\/horoscope\/daily\/sign/);
  assert.match(source, /from\("daily_horoscopes"\)/);
  assert.match(source, /onConflict: "horoscope_date,sign,locale"/);
  assert.doesNotMatch(source, /9bb847fd6f87410ba7c284f2e3ece249752e769bcaa8144f5da5e4c1ba8be81a/);
});

test('daily horoscope schedule sends the private cron secret header', () => {
  const sqlPath = path.join(root, 'supabase', 'sql', 'schedule-sync-daily-horoscopes.sql');
  const source = fs.readFileSync(sqlPath, 'utf8');

  assert.match(source, /x-cron-secret/);
  assert.match(source, /CRON_SECRET/);
  assert.doesNotMatch(source, /9bb847fd6f87410ba7c284f2e3ece249752e769bcaa8144f5da5e4c1ba8be81a/);
});

test('daily horoscope translation SQL adds Chinese fallback columns', () => {
  const sqlPath = path.join(root, 'supabase', 'sql', 'daily-horoscope-translation-fields.sql');
  const source = fs.readFileSync(sqlPath, 'utf8');

  [
    'content_text_zh',
    'theme_zh',
    'keywords_zh',
    'do_items_zh',
    'dont_items_zh',
    'supporting_insights_zh',
    'translation_provider',
    'translated_at',
  ].forEach((column) => {
    assert.match(source, new RegExp(`add column if not exists ${column}`));
  });
});
