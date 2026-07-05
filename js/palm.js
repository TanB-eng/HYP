/**
 * Palm View（手相功能）
 * 本地图片上传、Canvas 参考线互动、Gemini 可选解读与知识百科
 * 全局命名空间: PalmView
 */
(function(root, factory) {
  var api = factory(root);
  if (root) root.PalmView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function(root) {
  'use strict';

  var MAX_FILE_SIZE = 10 * 1024 * 1024;
  var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MIN_ZOOM = 0.5;
  var MAX_ZOOM = 3;
  var GEMINI_MODEL = 'gemini-2.5-flash';
  var API_KEY_STORAGE = 'hyp_palm_apikey';
  var LINE_NUMBERS = { heart: '①', head: '②', life: '③', fate: '④' };
  var AI_TRAIT_LABEL = 'AI 个性化解读';
  var AI_LINE_SECTIONS = [
    { id: 'heart', heading: '感情线分析' },
    { id: 'head', heading: '智慧线分析' },
    { id: 'life', heading: '生命线分析' },
    { id: 'fate', heading: '事业线分析' }
  ];

  var state = {
    root: null,
    canvas: null,
    context: null,
    image: null,
    imageDataUrl: '',
    mimeType: '',
    rotation: 0,
    zoom: 1,
    activeLineId: 'heart',
    interpretations: {},
    aiInterpretations: {},
    markers: {},
    listeners: [],
    abortController: null,
    layout: null
  };

  function validateFile(file) {
    if (!file || ALLOWED_TYPES.indexOf(file.type) === -1) {
      return { valid: false, message: '仅支持 JPG、PNG 或 WebP 图片' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, message: '图片大小不能超过 10MB' };
    }
    return { valid: true, message: '' };
  }

  function decodeImageFile(file, FileReaderConstructor, ImageConstructor) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReaderConstructor();
      reader.onerror = function() {
        var error = new Error('Unable to read image file');
        error.code = 'READ_FAILED';
        reject(error);
      };
      reader.onload = function() {
        var image = new ImageConstructor();
        image.onerror = function() {
          var error = new Error('Unable to decode image');
          error.code = 'IMAGE_FAILED';
          reject(error);
        };
        image.onload = function() {
          resolve({ image: image, dataUrl: reader.result });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function clampZoom(value) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  }

  function calculateImageLayout(imageWidth, imageHeight, canvasWidth, canvasHeight, rotation) {
    var rotated = Math.abs(rotation % 180) === 90;
    var displaySourceWidth = rotated ? imageHeight : imageWidth;
    var displaySourceHeight = rotated ? imageWidth : imageHeight;
    var scale = Math.min(
      canvasWidth / displaySourceWidth,
      canvasHeight / displaySourceHeight
    ) * 0.94;
    return {
      imageWidth: imageWidth * scale,
      imageHeight: imageHeight * scale,
      displayWidth: displaySourceWidth * scale,
      displayHeight: displaySourceHeight * scale
    };
  }

  function pointSegmentDistance(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    if (dx === 0 && dy === 0) {
      return Math.sqrt(Math.pow(px - ax, 2) + Math.pow(py - ay, 2));
    }
    var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    var nearestX = ax + t * dx;
    var nearestY = ay + t * dy;
    return Math.sqrt(Math.pow(px - nearestX, 2) + Math.pow(py - nearestY, 2));
  }

  function isPointNearPath(x, y, points, width, height, tolerance) {
    if (!points || points.length < 2) return false;
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1];
      var b = points[i];
      if (pointSegmentDistance(
        x, y,
        a[0] * width, a[1] * height,
        b[0] * width, b[1] * height
      ) <= tolerance) {
        return true;
      }
    }
    return false;
  }

  function buildGeminiPayload(mimeType, base64Data) {
    return {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: [
              '你是一位熟悉传统手相文化的解读者。请分析这张右手掌照片，并用中文解读：',
              '## 感情线分析',
              '## 智慧线分析',
              '## 生命线分析',
              '## 事业线分析',
              '## 综合解读',
              '可以包含传统手相中的健康与寿命说法，但不得伪装成确定事实。',
              '结尾必须写明：以上分析仅供娱乐参考，不构成医疗建议。'
            ].join('\n')
          }
        ]
      }]
    };
  }

  function extractGeminiText(data) {
    if (!data || !data.candidates || !data.candidates[0]) return '';
    var content = data.candidates[0].content;
    if (!content || !content.parts) return '';
    return content.parts.map(function(part) {
      return part.text || '';
    }).join('\n').trim();
  }

  function getAiSectionId(heading) {
    for (var i = 0; i < AI_LINE_SECTIONS.length; i++) {
      if (heading.indexOf(AI_LINE_SECTIONS[i].heading) !== -1) {
        return AI_LINE_SECTIONS[i].id;
      }
    }
    return null;
  }

  function cleanAiSectionText(lines) {
    return lines.join('\n').replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
  }

  function extractAiLineInterpretations(markdown) {
    var buffers = {};
    var readings = {};
    var activeId = null;
    var lines = String(markdown || '').split(/\r?\n/);

    AI_LINE_SECTIONS.forEach(function(section) {
      buffers[section.id] = [];
    });

    lines.forEach(function(rawLine) {
      var headingMatch = rawLine.match(/^\s{0,3}#{1,6}\s*(.+?)\s*#*\s*$/);
      if (headingMatch) {
        activeId = getAiSectionId(headingMatch[1].trim());
        return;
      }
      if (activeId) {
        buffers[activeId].push(rawLine);
      }
    });

    AI_LINE_SECTIONS.forEach(function(section) {
      var meaning = cleanAiSectionText(buffers[section.id]);
      if (meaning) {
        readings[section.id] = {
          trait: AI_TRAIT_LABEL,
          meaning: meaning
        };
      }
    });

    return readings;
  }

  function getGeminiErrorMessage(error) {
    if (error && error.name === 'AbortError') {
      return 'AI 分析超时，请检查网络后重试';
    }
    if (error && (error.status === 401 || error.status === 403)) {
      return 'API Key 无效或无权限，请检查后重试';
    }
    if (error && error.status === 429) {
      return '请求额度已用尽或过于频繁，请稍后重试';
    }
    if (error && error.status === 404) {
      return 'AI 模型暂不可用，请稍后重试';
    }
    if (error && error.status >= 500) {
      return 'Google AI 服务暂时不可用，请稍后重试';
    }
    if (error && error.code === 'EMPTY_RESPONSE') {
      return 'AI 未返回可用内容，请重新分析';
    }
    return '网络请求失败，请检查网络后重试';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderInlineMarkdown(value) {
    return value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function renderSafeMarkdown(markdown) {
    var lines = escapeHtml(markdown).split(/\r?\n/);
    var html = [];
    var inList = false;

    lines.forEach(function(rawLine) {
      var line = rawLine.trim();
      if (!line) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        return;
      }
      if (line.indexOf('## ') === 0) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        html.push('<h3>' + renderInlineMarkdown(line.slice(3)) + '</h3>');
      } else if (line.indexOf('- ') === 0) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push('<li>' + renderInlineMarkdown(line.slice(2)) + '</li>');
      } else {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        html.push('<p>' + renderInlineMarkdown(line) + '</p>');
      }
    });

    if (inList) html.push('</ul>');
    return html.join('');
  }

  function applyAiInterpretations(markdown) {
    var data = getPalmData();
    var readings = extractAiLineInterpretations(markdown);
    var lineIds = Object.keys(readings);
    if (!lineIds.length) return false;

    state.aiInterpretations = readings;
    lineIds.forEach(function(lineId) {
      state.interpretations[lineId] = readings[lineId];
    });

    renderLinePicker();
    if (data) {
      var activeLine = data.getLine(state.activeLineId);
      if (activeLine && state.interpretations[activeLine.id]) {
        renderReading(activeLine);
      }
    }
    renderReport();
    return true;
  }

  function getViewMarkup() {
    return [
      '<section class="view-palm" aria-labelledby="palm-title">',
      '  <header class="palm-hero">',
      '    <div class="palm-orbit" aria-hidden="true"><span>✦</span><span>✋</span><span>✧</span></div>',
      '    <p class="palm-kicker">CELESTIAL PALM OBSERVATORY</p>',
      '    <h1 class="view-title" id="palm-title">掌心星轨</h1>',
      '    <p class="view-subtitle">上传右手掌照片，在四条掌纹中阅读属于你的趣味星图</p>',
      '  </header>',
      '',
      '  <div class="palm-topbar">',
      '    <div class="palm-mode-copy"><span class="palm-live-dot"></span>离线趣味模式随时可用</div>',
      '    <div class="palm-ai-actions">',
      '      <button class="palm-btn palm-btn-ghost" id="palm-key-btn" type="button">设置 API Key</button>',
      '      <button class="palm-btn palm-btn-ai" id="palm-ai-btn" type="button" disabled>✦ AI 深度解读</button>',
      '    </div>',
      '  </div>',
      '  <p class="palm-ai-privacy">使用 AI 时，照片将直接发送至 Google Gemini API；本站不经过其他服务器，也不会额外弹出确认。</p>',
      '',
      '  <div class="palm-alert" id="palm-alert" role="status" aria-live="polite" hidden></div>',
      '',
      '  <section class="palm-upload-card" id="palm-upload-section">',
      '    <div class="palm-upload-zone" id="palm-upload-zone" role="button" tabindex="0" aria-label="上传右手掌照片">',
      '      <input id="palm-file-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>',
      '      <div class="palm-hand-glyph" aria-hidden="true">✋</div>',
      '      <h2>上传手掌照片</h2>',
      '      <p>点击选择或将照片拖到此处</p>',
      '      <span class="palm-photo-rule">仅支持右手掌 · 掌心朝向镜头 · 手指朝上</span>',
      '      <small>JPG / PNG / WebP，最大 10MB</small>',
      '    </div>',
      '    <div class="palm-local-note"><span>⌁</span>照片默认只在当前浏览器内存中处理，刷新页面即清除</div>',
      '  </section>',
      '',
      '  <section class="palm-workspace" id="palm-workspace" hidden>',
      '    <div class="palm-line-picker" id="palm-line-picker" aria-label="选择掌纹线"></div>',
      '    <div class="palm-analysis-grid">',
      '      <div class="palm-canvas-card">',
      '        <div class="palm-canvas-wrap" id="palm-canvas-wrap">',
      '          <canvas id="palm-canvas" aria-label="手掌照片与掌纹参考线"></canvas>',
      '          <div class="palm-canvas-hint">选择或直接点击一条参考线</div>',
      '        </div>',
      '        <div class="palm-canvas-controls">',
      '          <button class="palm-btn palm-btn-ghost" id="palm-rotate-left" type="button">↶ 左转 90°</button>',
      '          <button class="palm-btn palm-btn-ghost" id="palm-rotate-right" type="button">↷ 右转 90°</button>',
      '          <button class="palm-btn palm-btn-ghost" id="palm-clear-markers" type="button">清除标记</button>',
      '          <button class="palm-btn palm-btn-accent" id="palm-reupload" type="button">重新上传</button>',
      '        </div>',
      '        <p class="palm-zoom-note">桌面端可使用鼠标滚轮缩放照片</p>',
      '      </div>',
      '      <aside class="palm-reading-panel" id="palm-reading-panel">',
      '        <div class="palm-panel-empty">',
      '          <span>⌁</span>',
      '          <h2>等待掌纹落点</h2>',
      '          <p>从上方选择一条掌纹，再点击照片上的对应参考线。</p>',
      '        </div>',
      '      </aside>',
      '    </div>',
      '    <section class="palm-report" id="palm-report" hidden></section>',
      '    <section class="palm-ai-result" id="palm-ai-result" hidden></section>',
      '  </section>',
      '',
      '  <details class="palm-knowledge" id="palm-knowledge">',
      '    <summary><span>掌纹图鉴</span><small>四条主线的传统含义与常见变化</small></summary>',
      '    <div class="palm-knowledge-body">',
      '      <div class="palm-knowledge-tabs" id="palm-knowledge-tabs" role="tablist"></div>',
      '      <div class="palm-knowledge-content" id="palm-knowledge-content"></div>',
      '    </div>',
      '  </details>',
      '',
      '  <footer class="palm-disclaimer">',
      '    <span aria-hidden="true">☾</span>',
      '    <p>本功能仅供娱乐参考，不构成任何专业建议。传统健康及寿命说法不构成医疗建议。</p>',
      '  </footer>',
      '',
      '  <div class="palm-modal" id="palm-key-modal" role="dialog" aria-modal="true" aria-labelledby="palm-key-title" hidden>',
      '    <div class="palm-modal-backdrop" data-close-modal></div>',
      '    <div class="palm-modal-card">',
      '      <button class="palm-modal-close" type="button" data-close-modal aria-label="关闭">×</button>',
      '      <p class="palm-kicker">OPTIONAL AI MODE</p>',
      '      <h2 id="palm-key-title">设置 Gemini API Key</h2>',
      '      <p>Key 仅保存在此浏览器的 localStorage，并只发送给 Google Gemini API。</p>',
      '      <label for="palm-key-input">API Key</label>',
      '      <input id="palm-key-input" class="palm-key-input" type="password" autocomplete="off" placeholder="AIza...">',
      '      <div class="palm-modal-actions">',
      '        <button class="palm-btn palm-btn-ghost" id="palm-key-clear" type="button">清除 Key</button>',
      '        <button class="palm-btn palm-btn-accent" id="palm-key-save" type="button">保存 Key</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('\n');
  }

  function addListener(element, eventName, handler, options) {
    if (!element) return;
    element.addEventListener(eventName, handler, options);
    state.listeners.push(function() {
      element.removeEventListener(eventName, handler, options);
    });
  }

  function byId(id) {
    return state.root ? state.root.querySelector('#' + id) : null;
  }

  function setHidden(element, hidden) {
    if (element) element.hidden = hidden;
  }

  function showAlert(message, kind) {
    var alert = byId('palm-alert');
    if (!alert) return;
    alert.textContent = message;
    alert.className = 'palm-alert ' + (kind ? 'is-' + kind : '');
    alert.hidden = !message;
  }

  function getPalmData() {
    return root && root.PalmData ? root.PalmData : null;
  }

  function renderLinePicker() {
    var data = getPalmData();
    var container = byId('palm-line-picker');
    if (!data || !container) return;
    container.innerHTML = data.getAllLines().map(function(line) {
      var active = line.id === state.activeLineId ? ' active' : '';
      return '<button class="palm-line-btn' + active + '" type="button" data-line-id="' + line.id +
        '" style="--line-color:' + line.color + '">' +
        '<span class="palm-line-number">' + LINE_NUMBERS[line.id] + '</span>' +
        '<span><strong>' + escapeHtml(line.name_cn) + '</strong><small>' + escapeHtml(line.name_en) + '</small></span>' +
        '<span class="palm-line-check">' + (state.interpretations[line.id] ? '✓' : '') + '</span>' +
        '</button>';
    }).join('');
  }

  function renderKnowledge(lineId) {
    var data = getPalmData();
    var tabs = byId('palm-knowledge-tabs');
    var content = byId('palm-knowledge-content');
    if (!data || !tabs || !content) return;
    var lines = data.getAllLines();
    var selected = data.getLine(lineId) || lines[0];

    tabs.innerHTML = lines.map(function(line) {
      var selectedAttr = line.id === selected.id ? ' aria-selected="true" class="active"' : ' aria-selected="false"';
      return '<button type="button" role="tab" data-knowledge-id="' + line.id + '"' + selectedAttr + '>' +
        escapeHtml(line.icon + ' ' + line.name_cn) + '</button>';
    }).join('');

    var points = selected.overlay.points.map(function(point) {
      return (point[0] * 180 + 20) + ',' + (point[1] * 220 + 10);
    }).join(' ');
    var variants = selected.interpretations.map(function(item) {
      return '<li><strong>' + escapeHtml(item.trait) + '</strong><span>' + escapeHtml(item.meaning) + '</span></li>';
    }).join('');

    content.innerHTML = [
      '<div class="palm-mini-map" aria-hidden="true">',
      '  <svg viewBox="0 0 220 250" role="img">',
      '    <path class="palm-hand-outline" d="M70 230 C52 206 46 174 48 145 L45 76 C45 65 58 63 62 74 L70 118 L68 41 C68 28 84 27 88 40 L93 111 L96 27 C97 14 113 14 116 27 L119 108 L126 38 C128 25 144 27 145 40 L144 119 L154 67 C157 55 172 58 171 71 L167 145 C164 178 154 207 139 230 Z"/>',
      '    <polyline points="' + points + '" style="--line-color:' + selected.color + '"/>',
      '  </svg>',
      '</div>',
      '<div class="palm-knowledge-copy">',
      '  <p class="palm-kicker">' + escapeHtml(selected.name_en) + '</p>',
      '  <h3>' + escapeHtml(selected.icon + ' ' + selected.name_cn) + '</h3>',
      '  <p><strong>位置：</strong>' + escapeHtml(selected.area) + '</p>',
      '  <p><strong>象征领域：</strong>' + escapeHtml(selected.domain) + '</p>',
      '  <p>' + escapeHtml(selected.description) + '</p>',
      '  <ul class="palm-variant-list">' + variants + '</ul>',
      '</div>'
    ].join('');
  }

  function resetAnalysis() {
    state.interpretations = {};
    state.aiInterpretations = {};
    state.markers = {};
    state.activeLineId = 'heart';
    renderLinePicker();
    renderReading(null);
    setHidden(byId('palm-report'), true);
    draw();
  }

  function resetImage() {
    state.image = null;
    state.imageDataUrl = '';
    state.mimeType = '';
    state.rotation = 0;
    state.zoom = 1;
    state.layout = null;
    resetAnalysis();
    setHidden(byId('palm-workspace'), true);
    setHidden(byId('palm-upload-section'), false);
    setHidden(byId('palm-ai-result'), true);
    var input = byId('palm-file-input');
    if (input) input.value = '';
    updateAiButton();
  }

  function resizeCanvas() {
    if (!state.canvas || !state.image) return;
    var wrap = byId('palm-canvas-wrap');
    var available = Math.max(280, Math.min(760, wrap ? wrap.clientWidth : 760));
    var rotated = Math.abs(state.rotation % 180) === 90;
    var imageWidth = rotated ? state.image.naturalHeight : state.image.naturalWidth;
    var imageHeight = rotated ? state.image.naturalWidth : state.image.naturalHeight;
    var logicalWidth = available;
    var logicalHeight = Math.max(320, Math.min(650, logicalWidth * imageHeight / imageWidth));
    var ratio = root && root.devicePixelRatio ? root.devicePixelRatio : 1;

    state.canvas.style.width = logicalWidth + 'px';
    state.canvas.style.height = logicalHeight + 'px';
    state.canvas.width = Math.round(logicalWidth * ratio);
    state.canvas.height = Math.round(logicalHeight * ratio);
    state.context = state.canvas.getContext('2d');
    state.context.setTransform(ratio, 0, 0, ratio, 0, 0);

    var imageLayout = calculateImageLayout(
      state.image.naturalWidth,
      state.image.naturalHeight,
      logicalWidth,
      logicalHeight,
      state.rotation
    );
    state.layout = {
      width: logicalWidth,
      height: logicalHeight,
      imageWidth: imageLayout.imageWidth,
      imageHeight: imageLayout.imageHeight
    };
  }

  function applyImageTransform(context) {
    var layout = state.layout;
    context.translate(layout.width / 2, layout.height / 2);
    context.scale(state.zoom, state.zoom);
    context.rotate(state.rotation * Math.PI / 180);
  }

  function drawOverlay(context) {
    var data = getPalmData();
    if (!data) return;
    var layout = state.layout;
    data.getAllLines().forEach(function(line) {
      var selected = line.id === state.activeLineId;
      context.save();
      context.beginPath();
      line.overlay.points.forEach(function(point, index) {
        var x = (point[0] - 0.5) * layout.imageWidth;
        var y = (point[1] - 0.5) * layout.imageHeight;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = line.color;
      context.globalAlpha = selected ? 0.95 : 0.55;
      context.lineWidth = selected ? 5 / state.zoom : 3 / state.zoom;
      context.setLineDash(selected ? [] : [8 / state.zoom, 6 / state.zoom]);
      context.shadowColor = line.color;
      context.shadowBlur = selected ? 12 : 5;
      context.stroke();
      context.setLineDash([]);

      var label = line.overlay.labelPos;
      var labelX = (label[0] - 0.5) * layout.imageWidth;
      var labelY = (label[1] - 0.5) * layout.imageHeight;
      context.globalAlpha = 1;
      context.fillStyle = line.color;
      context.font = '600 ' + (13 / state.zoom) + 'px sans-serif';
      context.fillText(LINE_NUMBERS[line.id] + ' ' + line.name_cn, labelX, labelY);
      context.restore();
    });
  }

  function drawMarkers(context) {
    var data = getPalmData();
    if (!data) return;
    Object.keys(state.markers).forEach(function(lineId) {
      var marker = state.markers[lineId];
      var line = data.getLine(lineId);
      if (!line) return;
      var x = (marker.x - 0.5) * state.layout.imageWidth;
      var y = (marker.y - 0.5) * state.layout.imageHeight;
      context.save();
      context.beginPath();
      context.arc(x, y, 9 / state.zoom, 0, Math.PI * 2);
      context.fillStyle = line.color;
      context.shadowColor = line.color;
      context.shadowBlur = 18;
      context.fill();
      context.lineWidth = 3 / state.zoom;
      context.strokeStyle = '#fff';
      context.stroke();
      context.restore();
    });
  }

  function draw() {
    if (!state.image || !state.canvas) return;
    resizeCanvas();
    var context = state.context;
    var layout = state.layout;
    context.clearRect(0, 0, layout.width, layout.height);
    context.fillStyle = '#050511';
    context.fillRect(0, 0, layout.width, layout.height);
    context.save();
    applyImageTransform(context);
    context.drawImage(
      state.image,
      -layout.imageWidth / 2,
      -layout.imageHeight / 2,
      layout.imageWidth,
      layout.imageHeight
    );
    drawOverlay(context);
    drawMarkers(context);
    context.restore();
  }

  function canvasToImagePoint(clientX, clientY) {
    var rect = state.canvas.getBoundingClientRect();
    var screenX = clientX - rect.left - state.layout.width / 2;
    var screenY = clientY - rect.top - state.layout.height / 2;
    var scaledX = screenX / state.zoom;
    var scaledY = screenY / state.zoom;
    var angle = -state.rotation * Math.PI / 180;
    var localX = scaledX * Math.cos(angle) - scaledY * Math.sin(angle);
    var localY = scaledX * Math.sin(angle) + scaledY * Math.cos(angle);
    return {
      x: localX / state.layout.imageWidth + 0.5,
      y: localY / state.layout.imageHeight + 0.5
    };
  }

  function findClickedLine(point) {
    var data = getPalmData();
    if (!data) return null;
    var lines = data.getAllLines();
    var preferred = data.getLine(state.activeLineId);
    var ordered = preferred ? [preferred].concat(lines.filter(function(line) {
      return line.id !== preferred.id;
    })) : lines;
    for (var i = 0; i < ordered.length; i++) {
      if (isPointNearPath(
        point.x * state.layout.imageWidth,
        point.y * state.layout.imageHeight,
        ordered[i].overlay.points,
        state.layout.imageWidth,
        state.layout.imageHeight,
        24 / state.zoom
      )) {
        return ordered[i];
      }
    }
    return null;
  }

  function renderReading(line) {
    var panel = byId('palm-reading-panel');
    if (!panel) return;
    if (!line) {
      panel.innerHTML = [
        '<div class="palm-panel-empty">',
        '<span>⌁</span><h2>等待掌纹落点</h2>',
        '<p>从上方选择一条掌纹，再点击照片上的对应参考线。</p>',
        '</div>'
      ].join('');
      return;
    }
    var reading = state.interpretations[line.id];
    panel.innerHTML = [
      '<div class="palm-reading-head" style="--line-color:' + line.color + '">',
      '<span>' + escapeHtml(line.icon) + '</span>',
      '<div><p class="palm-kicker">' + escapeHtml(line.name_en) + '</p><h2>' + escapeHtml(line.name_cn) + '</h2></div>',
      '</div>',
      '<dl class="palm-reading-facts">',
      '<div><dt>位置</dt><dd>' + escapeHtml(line.area) + '</dd></div>',
      '<div><dt>象征</dt><dd>' + escapeHtml(line.domain) + '</dd></div>',
      '</dl>',
      '<p class="palm-reading-description">' + escapeHtml(line.description) + '</p>',
      '<div class="palm-reading-omen" style="--line-color:' + line.color + '">',
      '<small>本次趣味解读</small><strong>' + escapeHtml(reading.trait) + '</strong>',
      '<p>' + escapeHtml(reading.meaning) + '</p>',
      '</div>',
      '<p class="palm-reading-mode">✦ 娱乐模式 · 仅供参考</p>'
    ].join('');
  }

  function renderReport() {
    var data = getPalmData();
    var report = byId('palm-report');
    if (!data || !report) return;
    var lines = data.getAllLines();
    if (Object.keys(state.interpretations).length < lines.length) {
      report.hidden = true;
      return;
    }
    report.innerHTML = [
      '<div class="palm-section-heading"><p class="palm-kicker">COMPLETE READING</p><h2>你的掌心星轨报告</h2></div>',
      '<div class="palm-report-grid">',
      lines.map(function(line) {
        var item = state.interpretations[line.id];
        return '<article style="--line-color:' + line.color + '"><span>' + line.icon + '</span><h3>' +
          escapeHtml(line.name_cn) + ' · ' + escapeHtml(item.trait) + '</h3><p>' +
          escapeHtml(item.meaning) + '</p></article>';
      }).join(''),
      '</div>',
      '<button class="palm-btn palm-btn-accent" id="palm-reset-analysis" type="button">重新分析</button>',
      '<p class="palm-health-note">传统健康及寿命说法仅供娱乐参考，不构成医疗建议。</p>'
    ].join('');
    report.hidden = false;
    addListener(byId('palm-reset-analysis'), 'click', resetAnalysis);
  }

  function identifyLine(line, point) {
    var data = getPalmData();
    if (!data || !line) return;
    state.activeLineId = line.id;
    state.markers[line.id] = point;
    state.interpretations[line.id] = state.aiInterpretations[line.id] || data.getRandomInterpretation(line.id);
    renderLinePicker();
    renderReading(line);
    renderReport();
    draw();
    showAlert('已记录' + line.name_cn + '的趣味解读', 'success');
  }

  function handleCanvasClick(event) {
    if (!state.image) return;
    var point = canvasToImagePoint(event.clientX, event.clientY);
    var line = findClickedLine(point);
    if (!line) {
      showAlert('请点击彩色掌纹参考线附近', 'warning');
      return;
    }
    identifyLine(line, point);
  }

  function handleFile(file) {
    var validation = validateFile(file);
    if (!validation.valid) {
      showAlert(validation.message, 'error');
      return;
    }
    showAlert('正在读取照片…', 'info');
    decodeImageFile(file, root.FileReader, root.Image).then(function(decoded) {
      state.image = decoded.image;
      state.imageDataUrl = decoded.dataUrl;
      state.mimeType = file.type;
      state.rotation = 0;
      state.zoom = 1;
      state.interpretations = {};
      state.aiInterpretations = {};
      state.markers = {};
      state.activeLineId = 'heart';
      setHidden(byId('palm-upload-section'), true);
      setHidden(byId('palm-workspace'), false);
      renderLinePicker();
      renderReading(null);
      setHidden(byId('palm-report'), true);
      setHidden(byId('palm-ai-result'), true);
      draw();
      updateAiButton();
      showAlert('照片已载入。请从彩色参考线开始探索。', 'success');
    }).catch(function(error) {
      var message = error.code === 'IMAGE_FAILED'
        ? '图片内容损坏或无法解析，请重新选择'
        : '无法读取图片，请重新选择';
      showAlert(message, 'error');
    });
  }

  function getStoredKey() {
    if (!root || !root.localStorage) return '';
    try {
      return root.localStorage.getItem(API_KEY_STORAGE) || '';
    } catch (error) {
      return '';
    }
  }

  function updateAiButton() {
    var button = byId('palm-ai-btn');
    var keyButton = byId('palm-key-btn');
    var hasKey = Boolean(getStoredKey());
    if (button) button.disabled = !hasKey || !state.image;
    if (keyButton) keyButton.textContent = hasKey ? 'API Key 已设置' : '设置 API Key';
  }

  function openKeyModal() {
    var modal = byId('palm-key-modal');
    var input = byId('palm-key-input');
    if (!modal) return;
    modal.hidden = false;
    if (input) {
      input.value = getStoredKey();
      root.setTimeout(function() { input.focus(); }, 0);
    }
  }

  function closeKeyModal() {
    setHidden(byId('palm-key-modal'), true);
  }

  function saveKey() {
    var input = byId('palm-key-input');
    var value = input ? input.value.trim() : '';
    if (!value) {
      showAlert('请输入 Gemini API Key', 'warning');
      return;
    }
    try {
      root.localStorage.setItem(API_KEY_STORAGE, value);
      updateAiButton();
      closeKeyModal();
      showAlert('API Key 已保存在当前浏览器', 'success');
    } catch (error) {
      showAlert('浏览器禁止本地存储，无法保存 API Key', 'error');
    }
  }

  function clearKey() {
    try {
      root.localStorage.removeItem(API_KEY_STORAGE);
    } catch (error) {
      // Storage may be unavailable; UI still resets.
    }
    var input = byId('palm-key-input');
    if (input) input.value = '';
    updateAiButton();
    closeKeyModal();
    showAlert('API Key 已清除', 'success');
  }

  function compressImage() {
    var maxDimension = 1024;
    var width = state.image.naturalWidth;
    var height = state.image.naturalHeight;
    var scale = Math.min(1, maxDimension / Math.max(width, height));
    var canvas = root.document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(state.image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  function setAiLoading(loading) {
    var button = byId('palm-ai-btn');
    if (!button) return;
    button.disabled = loading || !getStoredKey() || !state.image;
    button.textContent = loading ? 'AI 正在分析手相…' : '✦ AI 深度解读';
    button.classList.toggle('is-loading', loading);
  }

  function renderAiResult(markdown) {
    var panel = byId('palm-ai-result');
    if (!panel) return;
    panel.innerHTML = [
      '<div class="palm-section-heading"><p class="palm-kicker">GEMINI READING</p><h2>AI 深度解读</h2></div>',
      '<div class="palm-ai-copy">' + renderSafeMarkdown(markdown) + '</div>',
      '<div class="palm-ai-result-actions">',
      '<button class="palm-btn palm-btn-ghost" id="palm-copy-ai" type="button">复制结果</button>',
      '<button class="palm-btn palm-btn-accent" id="palm-rerun-ai" type="button">重新分析</button>',
      '</div>',
      '<p class="palm-health-note">AI 解读由 Google Gemini 生成，仅供娱乐参考；传统健康及寿命说法不构成医疗建议。</p>'
    ].join('');
    panel.hidden = false;
    addListener(byId('palm-copy-ai'), 'click', function() {
      if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(markdown).then(function() {
          showAlert('AI 解读已复制', 'success');
        }).catch(function() {
          showAlert('复制失败，请手动选择文本', 'error');
        });
      } else {
        showAlert('当前浏览器不支持一键复制', 'warning');
      }
    });
    addListener(byId('palm-rerun-ai'), 'click', runAiAnalysis);
  }

  function runAiAnalysis() {
    var key = getStoredKey();
    if (!state.image) {
      showAlert('请先上传手掌照片', 'warning');
      return;
    }
    if (!key) {
      showAlert('请先设置 Gemini API Key', 'warning');
      openKeyModal();
      return;
    }

    if (state.abortController) state.abortController.abort();
    state.abortController = new root.AbortController();
    var controller = state.abortController;
    var timeout = root.setTimeout(function() {
      controller.abort();
    }, 30000);
    setAiLoading(true);
    showAlert('AI 正在分析手相…', 'info');

    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
    var payload = buildGeminiPayload('image/jpeg', compressImage());

    root.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).then(function(response) {
      if (!response.ok) {
        var requestError = new Error('Gemini request failed');
        requestError.status = response.status;
        throw requestError;
      }
      return response.json();
    }).then(function(data) {
      var text = extractGeminiText(data);
      if (!text) {
        var emptyError = new Error('Empty response');
        emptyError.code = 'EMPTY_RESPONSE';
        throw emptyError;
      }
      renderAiResult(text);
      applyAiInterpretations(text);
      showAlert('AI 深度解读已生成', 'success');
    }).catch(function(error) {
      showAlert(getGeminiErrorMessage(error), 'error');
    }).finally(function() {
      root.clearTimeout(timeout);
      if (state.abortController === controller) state.abortController = null;
      setAiLoading(false);
    });
  }

  function bindEvents() {
    var uploadZone = byId('palm-upload-zone');
    var input = byId('palm-file-input');

    addListener(uploadZone, 'click', function() { input.click(); });
    addListener(uploadZone, 'keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });
    addListener(input, 'change', function() {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    });
    ['dragenter', 'dragover'].forEach(function(eventName) {
      addListener(uploadZone, eventName, function(event) {
        event.preventDefault();
        uploadZone.classList.add('is-dragging');
      });
    });
    ['dragleave', 'drop'].forEach(function(eventName) {
      addListener(uploadZone, eventName, function(event) {
        event.preventDefault();
        uploadZone.classList.remove('is-dragging');
      });
    });
    addListener(uploadZone, 'drop', function(event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files[0]) handleFile(files[0]);
    });

    addListener(byId('palm-line-picker'), 'click', function(event) {
      var button = event.target.closest('[data-line-id]');
      if (!button) return;
      state.activeLineId = button.getAttribute('data-line-id');
      renderLinePicker();
      draw();
    });
    addListener(byId('palm-knowledge-tabs'), 'click', function(event) {
      var button = event.target.closest('[data-knowledge-id]');
      if (button) renderKnowledge(button.getAttribute('data-knowledge-id'));
    });
    addListener(state.canvas, 'click', handleCanvasClick);
    addListener(state.canvas, 'wheel', function(event) {
      var finePointer = !root.matchMedia || root.matchMedia('(pointer: fine)').matches;
      if (!finePointer || root.innerWidth <= 768 || !state.image) return;
      event.preventDefault();
      state.zoom = clampZoom(state.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
      draw();
    }, { passive: false });
    addListener(byId('palm-rotate-left'), 'click', function() {
      state.rotation = (state.rotation - 90) % 360;
      draw();
    });
    addListener(byId('palm-rotate-right'), 'click', function() {
      state.rotation = (state.rotation + 90) % 360;
      draw();
    });
    addListener(byId('palm-clear-markers'), 'click', function() {
      state.markers = {};
      draw();
      showAlert('画布标记已清除，解读记录仍保留', 'success');
    });
    addListener(byId('palm-reupload'), 'click', resetImage);
    addListener(byId('palm-key-btn'), 'click', openKeyModal);
    addListener(byId('palm-key-save'), 'click', saveKey);
    addListener(byId('palm-key-clear'), 'click', clearKey);
    addListener(byId('palm-ai-btn'), 'click', runAiAnalysis);
    state.root.querySelectorAll('[data-close-modal]').forEach(function(element) {
      addListener(element, 'click', closeKeyModal);
    });
    addListener(root, 'keydown', function(event) {
      if (event.key === 'Escape') closeKeyModal();
    });
    addListener(root, 'resize', function() {
      if (state.image) draw();
    });
  }

  function render() {
    if (!root || !root.document) return;
    destroy();
    var appView = root.document.getElementById('app-view');
    if (!appView) return;
    appView.innerHTML = getViewMarkup();
    state.root = appView.querySelector('.view-palm');
    state.canvas = byId('palm-canvas');
    state.context = state.canvas ? state.canvas.getContext('2d') : null;
    renderLinePicker();
    renderKnowledge('heart');
    bindEvents();
    updateAiButton();
  }

  function destroy() {
    state.listeners.splice(0).forEach(function(removeListener) {
      removeListener();
    });
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    state.root = null;
    state.canvas = null;
    state.context = null;
    state.image = null;
    state.imageDataUrl = '';
    state.layout = null;
    state.interpretations = {};
    state.aiInterpretations = {};
    state.markers = {};
  }

  return {
    render: render,
    destroy: destroy,
    validateFile: validateFile,
    decodeImageFile: decodeImageFile,
    clampZoom: clampZoom,
    calculateImageLayout: calculateImageLayout,
    isPointNearPath: isPointNearPath,
    buildGeminiPayload: buildGeminiPayload,
    extractGeminiText: extractGeminiText,
    extractAiLineInterpretations: extractAiLineInterpretations,
    getGeminiErrorMessage: getGeminiErrorMessage,
    renderSafeMarkdown: renderSafeMarkdown,
    getViewMarkup: getViewMarkup
  };
});
