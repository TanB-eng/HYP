const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createSandbox() {
  return {
    window: {},
    document: {
      getElementById() {
        return null;
      },
      createElement() {
        return {};
      },
      body: {}
    },
    setTimeout() {},
    clearTimeout() {}
  };
}

function loadZodiacData() {
  const sandbox = createSandbox();
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8'),
    sandbox
  );
  return sandbox.window.ZodiacData;
}

function loadBrowseView() {
  const sandbox = createSandbox();
  sandbox.window.Storage = {
    Favorites: { has() { return false; } },
    Notes: { get() { return ''; }, set() {} }
  };
  sandbox.window.Router = { navigate() {} };

  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8'),
    sandbox
  );
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js', 'browse.js'), 'utf8'),
    sandbox
  );
  return {
    BrowseView: sandbox.window.BrowseView,
    ZodiacData: sandbox.window.ZodiacData
  };
}

test('provides male and female personality notes for every zodiac sign', () => {
  const ZodiacData = loadZodiacData();
  const signs = ZodiacData.getAll();

  assert.equal(signs.length, 12);
  signs.forEach((sign) => {
    assert.ok(sign.gender_personality, `${sign.id} missing gender personality`);
    assert.match(sign.gender_personality.male, /。$/);
    assert.match(sign.gender_personality.female, /。$/);
  });
});

test('renders gender personality cards in the detail personality section', () => {
  const { BrowseView, ZodiacData } = loadBrowseView();
  const html = BrowseView.renderGenderPersonality(ZodiacData.getById('scorpio'));

  assert.match(html, /男生常见表现/);
  assert.match(html, /女生常见表现/);
  assert.match(html, /天蝎男/);
  assert.match(html, /天蝎女/);
  assert.match(html, /个体差异/);
});
