const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function loadAuthModule() {
  const modulePath = path.join(root, 'js', 'auth.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('provides auth helper functions for nav labels and modal markup', () => {
  const AuthUI = loadAuthModule();
  const markup = AuthUI.getAuthModalMarkup();

  assert.equal(AuthUI.isConfigured({
    url: 'https://example.supabase.co',
    key: 'sb_publishable_example'
  }), true);
  assert.equal(AuthUI.isConfigured({
    url: '',
    key: 'sb_publishable_example'
  }), false);
  assert.equal(AuthUI.formatUserLabel('stellarguest@example.com'), 'stellarguest');
  assert.equal(AuthUI.formatUserLabel(''), '我的账户');
  assert.match(markup, /id="auth-modal"/);
  assert.match(markup, /data-auth-mode="signin"/);
  assert.match(markup, /data-auth-mode="signup"/);
  assert.match(markup, /id="auth-email"/);
  assert.match(markup, /id="auth-password"/);
});

test('integrates Supabase bootstrap and auth entry into the static app shell', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  const storageJs = fs.readFileSync(path.join(root, 'js', 'storage.js'), 'utf8');
  const supabaseClientPath = path.join(root, 'js', 'supabase-client.js');

  assert.equal(fs.existsSync(supabaseClientPath), true);
  assert.match(indexHtml, /id="auth-slot"/);
  assert.match(indexHtml, /@supabase\/supabase-js@2/);
  assert.match(indexHtml, /src="js\/supabase-client\.js"/);
  assert.match(indexHtml, /src="js\/auth\.js"/);
  assert.match(appJs, /Storage\.init\(\)/);
  assert.match(appJs, /AuthUI\.init\(\)/);
  assert.match(storageJs, /window\.SupabaseClient/);
  assert.match(storageJs, /handleAuthChange/);
});
