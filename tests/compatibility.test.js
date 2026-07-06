const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const compatibilityPath = path.join(root, 'js', 'compatibility.js');

function createSandbox() {
  return {
    window: {},
    document: {
      getElementById() {
        return null;
      },
      querySelectorAll() {
        return [];
      }
    },
    module: { exports: {} },
    console
  };
}

function loadCompatibilityView() {
  const sandbox = createSandbox();
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8'),
    sandbox
  );
  vm.runInNewContext(
    fs.readFileSync(compatibilityPath, 'utf8'),
    sandbox
  );
  return sandbox.module.exports;
}

test('compatibility module exposes relationship types, chat counter, and base analysis', () => {
  const CompatibilityView = loadCompatibilityView();
  const ZodiacData = CompatibilityView.__test.getZodiacData();

  assert.equal(CompatibilityView.CHAT_LIMIT, 3000);
  assert.deepEqual(
    Array.from(CompatibilityView.RELATIONSHIP_TYPES.map((type) => type.id)),
    ['romance', 'flirt', 'friendship', 'work', 'family']
  );
  assert.deepEqual(JSON.parse(JSON.stringify(CompatibilityView.getChatCountState('星'.repeat(2999)))), {
    count: 2999,
    limit: 3000,
    status: 'warning',
    message: '已输入 2999 / 3000 字，接近上限'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(CompatibilityView.getChatCountState('星'.repeat(3001)))), {
    count: 3001,
    limit: 3000,
    status: 'error',
    message: '已输入 3001 / 3000 字，请删减后再分析'
  });

  const result = CompatibilityView.buildBaseAnalysis({
    signA: 'cancer',
    signB: 'libra',
    relationshipType: 'romance',
    zodiacData: ZodiacData
  });

  assert.equal(result.signA.id, 'cancer');
  assert.equal(result.signB.id, 'libra');
  assert.equal(result.relationshipType, 'romance');
  assert.ok(result.scores.overall >= 0 && result.scores.overall <= 100);
  assert.ok(result.scores.attraction >= 0 && result.scores.attraction <= 100);
  assert.ok(result.keywords.length >= 3);
  assert.match(result.summary, /巨蟹座|Cancer|cancer/i);
  assert.match(result.advice.join('\n'), /沟通|表达|边界|节奏/);
});

test('static app shell registers the compatibility route and script', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

  assert.match(indexHtml, /data-route="\/compatibility"/);
  assert.match(indexHtml, /src="js\/compatibility\.js(?:\?[^"]+)?"/);
  assert.match(appJs, /Router\.register\('#\/compatibility'/);
  assert.match(appJs, /CompatibilityView\.render\(\)/);
  assert.match(appJs, /route === '\/compatibility'/);
});
