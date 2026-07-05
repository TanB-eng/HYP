const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function loadPalm() {
  const modulePath = path.join(root, 'js', 'palm.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('validates supported image types and the 10MB limit', () => {
  const PalmView = loadPalm();

  assert.deepEqual(PalmView.validateFile({
    type: 'image/jpeg',
    size: 2 * 1024 * 1024
  }), { valid: true, message: '' });

  assert.deepEqual(PalmView.validateFile({
    type: 'image/gif',
    size: 2 * 1024 * 1024
  }), {
    valid: false,
    message: '仅支持 JPG、PNG 或 WebP 图片'
  });

  assert.deepEqual(PalmView.validateFile({
    type: 'image/png',
    size: 10 * 1024 * 1024 + 1
  }), {
    valid: false,
    message: '图片大小不能超过 10MB'
  });
});

test('decodes an uploaded file through FileReader and Image', async () => {
  const PalmView = loadPalm();

  class FakeFileReader {
    readAsDataURL() {
      this.result = 'data:image/png;base64,ZmFrZQ==';
      queueMicrotask(() => this.onload());
    }
  }

  class FakeImage {
    set src(value) {
      this.loadedSource = value;
      this.naturalWidth = 640;
      this.naturalHeight = 960;
      queueMicrotask(() => this.onload());
    }
  }

  const decoded = await PalmView.decodeImageFile(
    { type: 'image/png', size: 1024 },
    FakeFileReader,
    FakeImage
  );

  assert.equal(decoded.dataUrl, 'data:image/png;base64,ZmFrZQ==');
  assert.equal(decoded.image.naturalWidth, 640);
  assert.equal(decoded.image.naturalHeight, 960);
});

test('keeps desktop wheel zoom inside the supported range', () => {
  const PalmView = loadPalm();

  assert.equal(PalmView.clampZoom(0.1), 0.5);
  assert.equal(PalmView.clampZoom(1.4), 1.4);
  assert.equal(PalmView.clampZoom(4), 3);
});

test('fits a rotated image using its exchanged display dimensions', () => {
  const PalmView = loadPalm();
  const layout = PalmView.calculateImageLayout(1000, 500, 500, 500, 90);

  assert.equal(layout.imageWidth, 470);
  assert.equal(layout.imageHeight, 235);
  assert.equal(layout.displayWidth, 235);
  assert.equal(layout.displayHeight, 470);
});

test('detects pointer proximity to a normalized palm line', () => {
  const PalmView = loadPalm();
  const points = [[0.2, 0.5], [0.5, 0.5], [0.8, 0.5]];

  assert.equal(PalmView.isPointNearPath(250, 205, points, 500, 400, 12), true);
  assert.equal(PalmView.isPointNearPath(250, 270, points, 500, 400, 12), false);
});

test('builds a Gemini multimodal request without the data URL prefix', () => {
  const PalmView = loadPalm();
  const payload = PalmView.buildGeminiPayload('image/jpeg', 'ZmFrZQ==');

  assert.equal(payload.contents[0].parts[0].inlineData.mimeType, 'image/jpeg');
  assert.equal(payload.contents[0].parts[0].inlineData.data, 'ZmFrZQ==');
  assert.match(payload.contents[0].parts[1].text, /仅供娱乐参考，不构成医疗建议/);
});

test('extracts Gemini text and maps common request failures', () => {
  const PalmView = loadPalm();

  assert.equal(PalmView.extractGeminiText({
    candidates: [{ content: { parts: [{ text: '分析结果' }] } }]
  }), '分析结果');
  assert.equal(PalmView.getGeminiErrorMessage({ status: 403 }), 'API Key 无效或无权限，请检查后重试');
  assert.equal(PalmView.getGeminiErrorMessage({ status: 429 }), '请求额度已用尽或过于频繁，请稍后重试');
  assert.equal(PalmView.getGeminiErrorMessage({ name: 'AbortError' }), 'AI 分析超时，请检查网络后重试');
});

test('extracts palm line report content from Gemini headings', () => {
  const PalmView = loadPalm();
  const markdown = [
    '## 感情线分析',
    '情感表达更细腻，关系中重视安全感。',
    '',
    '## 智慧线分析',
    '- 思考方式清晰',
    '- 适合长期规划',
    '',
    '## 生命线分析',
    '精力节奏偏稳，注意劳逸结合。',
    '',
    '## 事业线分析',
    '职业发展更适合稳扎稳打。',
    '',
    '## 综合解读',
    '整体仅供娱乐参考。'
  ].join('\n');

  assert.deepEqual(PalmView.extractAiLineInterpretations(markdown), {
    heart: {
      trait: 'AI 个性化解读',
      meaning: '情感表达更细腻，关系中重视安全感。'
    },
    head: {
      trait: 'AI 个性化解读',
      meaning: '- 思考方式清晰\n- 适合长期规划'
    },
    life: {
      trait: 'AI 个性化解读',
      meaning: '精力节奏偏稳，注意劳逸结合。'
    },
    fate: {
      trait: 'AI 个性化解读',
      meaning: '职业发展更适合稳扎稳打。'
    }
  });
});

test('renders a safe subset of Markdown', () => {
  const PalmView = loadPalm();
  const html = PalmView.renderSafeMarkdown('## 标题\n**重点**\n<script>alert(1)</script>');

  assert.match(html, /<h3>标题<\/h3>/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('provides the required palm view landmarks', () => {
  const PalmView = loadPalm();
  const html = PalmView.getViewMarkup();

  assert.match(html, /class="view-palm"/);
  assert.match(html, /id="palm-upload-zone"/);
  assert.match(html, /id="palm-canvas"/);
  assert.match(html, /仅支持右手掌/);
  assert.match(html, /拍照前提醒/);
  assert.match(html, /请上传右手手掌照片/);
  assert.match(html, /API 获取教程/);
  assert.match(html, /https:\/\/aistudio\.google\.com\//);
  assert.match(html, /不要发给陌生人/);
  assert.match(html, /照片将直接发送至 Google Gemini API/);
  assert.match(html, /本功能仅供娱乐参考，不构成任何专业建议/);
});

test('integrates the palm stylesheet, scripts, navigation and route', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  const palmCssPath = path.join(root, 'css', 'palm.css');

  assert.equal(fs.existsSync(palmCssPath), true);
  assert.match(indexHtml, /href="#\/palm"/);
  assert.match(indexHtml, /src="js\/palm-data\.js"/);
  assert.match(indexHtml, /src="js\/palm\.js(?:\?[^"]+)?"/);
  assert.match(appJs, /Router\.register\('#\/palm'/);
  assert.match(appJs, /PalmView\.destroy/);
});
