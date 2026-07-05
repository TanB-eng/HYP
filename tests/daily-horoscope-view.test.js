const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('app shell loads the daily horoscope module before browse view', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(indexHtml, /src="js\/daily-horoscope\.js(?:\?[^"]+)?"/);
  assert.ok(
    indexHtml.indexOf('src="js/daily-horoscope.js') < indexHtml.indexOf('src="js/browse.js'),
    'daily horoscope module should load before browse view'
  );
});

test('browse view includes a daily horoscope mount point', () => {
  const browseJs = fs.readFileSync(path.join(root, 'js', 'browse.js'), 'utf8');

  assert.match(browseJs, /id="daily-horoscope-slot"/);
  assert.match(browseJs, /DailyHoroscopeView\.render\('daily-horoscope-slot'\)/);
});

test('daily horoscope view reads Supabase and prefers Chinese fields with English fallback', () => {
  const modulePath = path.join(root, 'js', 'daily-horoscope.js');
  const source = fs.readFileSync(modulePath, 'utf8');

  assert.match(source, /from\('daily_horoscopes'\)/);
  assert.match(source, /content_text_zh \|\| row\.content_text/);
  assert.match(source, /theme_zh \|\| row\.theme/);
  assert.match(source, /hyp_daily_horoscope_sign/);
  assert.match(source, /getLatestHoroscope/);
});

test('daily horoscope view falls back to the latest published database row', () => {
  const modulePath = path.join(root, 'js', 'daily-horoscope.js');
  const source = fs.readFileSync(modulePath, 'utf8');

  assert.match(source, /\.eq\('is_published', true\)/);
  assert.match(source, /\.order\('horoscope_date', \{ ascending: false \}\)/);
  assert.match(source, /\.limit\(1\)/);
  assert.doesNotMatch(source, /今日内容暂未同步/);
  assert.match(source, /暂无可用星运数据/);
});
