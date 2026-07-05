const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadFavoritesView() {
  const sandbox = {
    window: {
      addEventListener() {},
      ZodiacData: {
        getById(id) {
          if (id !== 'cancer') return null;
          return {
            id: 'cancer',
            name_cn: '巨蟹座',
            name_en: 'Cancer',
            date_range: '6月21日 - 7月22日',
            element: '水'
          };
        }
      }
    }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js', 'favorites.js'), 'utf8'),
    sandbox
  );
  return sandbox.window.FavoritesView;
}

test('formats exported notes as readable text instead of JSON', () => {
  const FavoritesView = loadFavoritesView();
  const text = FavoritesView.formatNotesText(['cancer'], {
    cancer: '观察巨蟹座的情绪变化。'
  });

  assert.match(text, /HYP星座研究 - 收藏笔记导出/);
  assert.match(text, /巨蟹座 Cancer/);
  assert.match(text, /日期：6月21日 - 7月22日/);
  assert.match(text, /元素：水象/);
  assert.match(text, /笔记：\n观察巨蟹座的情绪变化。/);
  assert.doesNotMatch(text.trim(), /^\{/);
});

test('uses the versioned favorites script in the app shell', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(indexHtml, /src="js\/favorites\.js(?:\?[^"]+)?"/);
});
