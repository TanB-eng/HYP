(function(root, factory) {
  var api = factory(root);
  if (root) root.CompatibilityView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function(root) {
  'use strict';

  var CHAT_LIMIT = 3000;
  var RELATIONSHIP_TYPES = [
    { id: 'romance', label: '恋爱', focus: '安全感、吸引力与长期稳定' },
    { id: 'flirt', label: '暧昧', focus: '互动节奏、试探感与不确定性' },
    { id: 'friendship', label: '朋友', focus: '轻松度、陪伴感与边界' },
    { id: 'work', label: '职场', focus: '协作方式、执行节奏与沟通效率' },
    { id: 'family', label: '家人', focus: '包容度、稳定感与情绪支持' }
  ];

  var state = {
    signA: 'cancer',
    signB: 'libra',
    relationshipType: 'romance',
    chatText: '',
    baseResult: null,
    aiResult: null,
    loading: false,
    status: ''
  };

  function getZodiacData() {
    return root && root.ZodiacData ? root.ZodiacData : null;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function getRelationshipType(id) {
    return RELATIONSHIP_TYPES.find(function(type) {
      return type.id === id;
    }) || RELATIONSHIP_TYPES[0];
  }

  function getChatCountState(text) {
    var count = String(text || '').length;
    var status = count > CHAT_LIMIT ? 'error' : (count >= 2700 ? 'warning' : 'normal');
    var message = '已输入 ' + count + ' / ' + CHAT_LIMIT + ' 字';
    if (status === 'warning') message += '，接近上限';
    if (status === 'error') message += '，请删减后再分析';
    return {
      count: count,
      limit: CHAT_LIMIT,
      status: status,
      message: message
    };
  }

  function buildBaseAnalysis(options) {
    var zodiacData = options.zodiacData || getZodiacData();
    var signA = zodiacData && zodiacData.getById ? zodiacData.getById(options.signA) : null;
    var signB = zodiacData && zodiacData.getById ? zodiacData.getById(options.signB) : null;
    var relationship = getRelationshipType(options.relationshipType);

    if (!signA || !signB) {
      throw new Error('Unsupported zodiac sign');
    }

    var sameElement = signA.element === signB.element;
    var sameModality = signA.modality === signB.modality;
    var listedMatch = (signA.compatibility || []).indexOf(signB.id) !== -1 ||
      (signB.compatibility || []).indexOf(signA.id) !== -1;
    var selfPair = signA.id === signB.id;

    var base = 62;
    if (sameElement) base += 12;
    if (listedMatch) base += 10;
    if (sameModality) base += selfPair ? 4 : -3;
    if (selfPair) base += 6;

    var typeAdjust = {
      romance: 4,
      flirt: 8,
      friendship: sameElement ? 8 : 3,
      work: sameModality ? -2 : 5,
      family: 2
    };
    base += typeAdjust[relationship.id] || 0;

    var scores = {
      overall: clampScore(base),
      attraction: clampScore(base + (relationship.id === 'flirt' ? 9 : 3) + (sameElement ? 5 : 0)),
      communication: clampScore(base + (sameElement ? 6 : -4) + (relationship.id === 'work' ? 3 : 0)),
      stability: clampScore(base + (relationship.id === 'family' ? 8 : 0) + (sameModality ? -2 : 3)),
      conflict: clampScore(100 - (base - (sameModality && !selfPair ? 8 : 0))),
      longTerm: clampScore(base + (relationship.id === 'romance' || relationship.id === 'family' ? 5 : 0))
    };

    var keywords = [];
    keywords.push(sameElement ? '同频理解' : '互补磨合');
    keywords.push(listedMatch ? '天然吸引' : '节奏校准');
    keywords.push(relationship.label + '关系');
    keywords.push(signA.element + '象 × ' + signB.element + '象');

    var summary = signA.name_cn + '和' + signB.name_cn + '在' + relationship.label +
      '关系里，核心看点是' + relationship.focus + '。' +
      (sameElement ? '你们容易用相似方式理解彼此。' : '你们的差异会带来吸引，也需要更清楚的表达。');

    var strengths = [
      signA.name_cn + '的' + signA.traits.slice(0, 2).join('、') + '，能给关系带来独特的主动性。',
      signB.name_cn + '的' + signB.traits.slice(0, 2).join('、') + '，会影响你们相处时的节奏。',
      listedMatch ? '传统配对资料中这组组合有较高的互相吸引。' : '这组组合适合通过明确沟通慢慢建立默契。'
    ];

    var risks = [
      sameModality && !selfPair ? '双方节奏相近时，容易都坚持自己的方式。' : '差异不是问题，真正的风险是把对方的反应想当然。',
      relationship.id === 'flirt' ? '暧昧阶段最容易被沉默和试探放大误会。' : '关系稳定需要持续的边界感和反馈。'
    ];

    var advice = [
      '先表达感受，再提出具体期待，避免只让对方猜。',
      '把沟通节奏说清楚，例如多久回复、什么时候适合认真聊。',
      '遇到分歧时先确认对方的意思，再讨论立场和边界。'
    ];

    return {
      signA: signA,
      signB: signB,
      relationshipType: relationship.id,
      relationshipLabel: relationship.label,
      scores: scores,
      keywords: keywords,
      summary: summary,
      strengths: strengths,
      risks: risks,
      advice: advice
    };
  }

  function buildSignOptions(selectedId) {
    var zodiacData = getZodiacData();
    var signs = zodiacData && zodiacData.getAll ? zodiacData.getAll() : [];
    return signs.map(function(sign) {
      var selected = sign.id === selectedId ? ' selected' : '';
      return '<option value="' + escapeHtml(sign.id) + '"' + selected + '>' +
        escapeHtml(sign.name_cn + ' · ' + sign.name_en) +
        '</option>';
    }).join('');
  }

  function buildRelationshipButtons() {
    return RELATIONSHIP_TYPES.map(function(type) {
      var active = type.id === state.relationshipType ? ' active' : '';
      return '<button class="compat-type-btn' + active + '" type="button" data-relationship="' +
        escapeHtml(type.id) + '">' + escapeHtml(type.label) + '</button>';
    }).join('');
  }

  function scoreBar(label, value) {
    return '<div class="compat-score-row">' +
      '<span>' + escapeHtml(label) + '</span>' +
      '<div class="compat-score-track"><i style="width:' + escapeHtml(value) + '%"></i></div>' +
      '<strong>' + escapeHtml(value) + '</strong>' +
      '</div>';
  }

  function listHtml(items) {
    return (items || []).map(function(item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
  }

  function renderBaseResult(result) {
    if (!result) {
      return '<div class="compat-empty-result">' +
        '<p>选择双方星座和关系类型后，点击“生成基础分析”。</p>' +
        '</div>';
    }

    return '<section class="compat-result-panel">' +
      '<div class="compat-result-head">' +
      '<div><span class="compat-sign-symbol">' + escapeHtml(result.signA.symbol) + '</span><strong>' + escapeHtml(result.signA.name_cn) + '</strong></div>' +
      '<div class="compat-orbit-score"><span>' + escapeHtml(result.scores.overall) + '</span><small>综合契合</small></div>' +
      '<div><span class="compat-sign-symbol">' + escapeHtml(result.signB.symbol) + '</span><strong>' + escapeHtml(result.signB.name_cn) + '</strong></div>' +
      '</div>' +
      '<div class="compat-keywords">' + result.keywords.map(function(keyword) {
        return '<span>' + escapeHtml(keyword) + '</span>';
      }).join('') + '</div>' +
      '<p class="compat-summary">' + escapeHtml(result.summary) + '</p>' +
      '<div class="compat-score-grid">' +
      scoreBar('吸引力', result.scores.attraction) +
      scoreBar('沟通', result.scores.communication) +
      scoreBar('稳定', result.scores.stability) +
      scoreBar('冲突风险', result.scores.conflict) +
      scoreBar('长期发展', result.scores.longTerm) +
      '</div>' +
      '<div class="compat-insight-grid">' +
      '<article><h3>吸引点</h3><ul>' + listHtml(result.strengths) + '</ul></article>' +
      '<article><h3>风险点</h3><ul>' + listHtml(result.risks) + '</ul></article>' +
      '<article><h3>相处建议</h3><ul>' + listHtml(result.advice) + '</ul></article>' +
      '</div>' +
      '</section>';
  }

  function renderAiResult() {
    var result = state.aiResult;
    if (!result) return '';

    return '<section class="compat-ai-result">' +
      '<p class="compat-section-kicker">GEMINI ANALYSIS</p>' +
      '<h2>AI 深度关系分析</h2>' +
      '<p>' + escapeHtml(result.summary || '') + '</p>' +
      '<div class="compat-ai-block"><h3>星座互动</h3><p>' + escapeHtml(result.zodiacDynamic || '') + '</p></div>' +
      '<div class="compat-ai-block"><h3>聊天模式</h3><p>' + escapeHtml(result.chatPattern || '') + '</p></div>' +
      '<div class="compat-insight-grid">' +
      '<article><h3>优势</h3><ul>' + listHtml(result.strengths) + '</ul></article>' +
      '<article><h3>风险</h3><ul>' + listHtml(result.risks) + '</ul></article>' +
      '<article><h3>建议</h3><ul>' + listHtml(result.advice) + '</ul></article>' +
      '</div>' +
      (result.nextMessageSuggestion ? '<blockquote class="compat-next-message">' + escapeHtml(result.nextMessageSuggestion) + '</blockquote>' : '') +
      '<p class="compat-disclaimer">' + escapeHtml(result.disclaimer || '内容仅供娱乐和自我反思参考。') + '</p>' +
      '</section>';
  }

  function render() {
    var app = root && root.document ? root.document.getElementById('app-view') : null;
    if (!app) return;

    var chatState = getChatCountState(state.chatText);
    var disabled = state.loading || chatState.status === 'error';

    app.innerHTML =
      '<div class="view-compatibility animate-fade-in">' +
      '<div class="compat-hero">' +
      '<p class="compat-kicker">RELATIONSHIP ASTROLOGY</p>' +
      '<h1 class="view-title">星座配对</h1>' +
      '<p class="view-subtitle">从星座性格与聊天片段中观察你们的关系节奏。</p>' +
      '</div>' +
      '<section class="compat-layout">' +
      '<form class="compat-form" id="compat-form">' +
      '<div class="compat-select-grid">' +
      '<label><span>我的星座</span><select id="compat-sign-a">' + buildSignOptions(state.signA) + '</select></label>' +
      '<label><span>对方星座</span><select id="compat-sign-b">' + buildSignOptions(state.signB) + '</select></label>' +
      '</div>' +
      '<div class="compat-type-group" role="group" aria-label="关系类型">' + buildRelationshipButtons() + '</div>' +
      '<label class="compat-chat-label" for="compat-chat-text">聊天片段，可选但推荐</label>' +
      '<textarea id="compat-chat-text" class="compat-chat-input" maxlength="3600" placeholder="我：你最近好像有点冷淡&#10;对方：没有，只是这几天比较忙&#10;我：那我们周末还见吗？">' +
      escapeHtml(state.chatText) + '</textarea>' +
      '<div class="compat-chat-meta compat-chat-' + chatState.status + '" id="compat-chat-count">' + escapeHtml(chatState.message) + '</div>' +
      '<p class="compat-privacy-note">聊天片段会发送给 Gemini 用于生成分析。请勿粘贴手机号、地址、身份证、银行卡、密码等敏感信息。</p>' +
      '<div class="compat-actions">' +
      '<button class="compat-primary-btn" type="submit">生成基础分析</button>' +
      '<button class="compat-ai-btn" id="compat-ai-btn" type="button"' + (disabled ? ' disabled' : '') + '>' +
      (state.loading ? 'AI 分析中...' : 'AI 深度关系分析') +
      '</button>' +
      '</div>' +
      '<p class="compat-status" id="compat-status" aria-live="polite">' + escapeHtml(state.status) + '</p>' +
      '</form>' +
      '<div class="compat-output">' + renderBaseResult(state.baseResult) + renderAiResult() + '</div>' +
      '</section>' +
      '</div>';

    bindEvents();
  }

  function bindEvents() {
    var form = root.document.getElementById('compat-form');
    var signA = root.document.getElementById('compat-sign-a');
    var signB = root.document.getElementById('compat-sign-b');
    var chat = root.document.getElementById('compat-chat-text');
    var aiButton = root.document.getElementById('compat-ai-btn');

    if (signA) signA.addEventListener('change', function() { state.signA = signA.value; });
    if (signB) signB.addEventListener('change', function() { state.signB = signB.value; });
    if (chat) {
      chat.addEventListener('input', function() {
        state.chatText = chat.value;
        updateChatCount();
      });
    }

    root.document.querySelectorAll('[data-relationship]').forEach(function(button) {
      button.addEventListener('click', function() {
        state.relationshipType = button.getAttribute('data-relationship');
        render();
      });
    });

    if (form) {
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        generateBaseAnalysis();
      });
    }
    if (aiButton) aiButton.addEventListener('click', runAiAnalysis);
  }

  function updateChatCount() {
    var count = root.document.getElementById('compat-chat-count');
    var aiButton = root.document.getElementById('compat-ai-btn');
    var chatState = getChatCountState(state.chatText);
    if (count) {
      count.textContent = chatState.message;
      count.className = 'compat-chat-meta compat-chat-' + chatState.status;
    }
    if (aiButton) aiButton.disabled = state.loading || chatState.status === 'error';
  }

  function generateBaseAnalysis() {
    state.baseResult = buildBaseAnalysis({
      signA: state.signA,
      signB: state.signB,
      relationshipType: state.relationshipType
    });
    state.aiResult = null;
    state.status = '';
    render();
  }

  async function runAiAnalysis() {
    var chatState = getChatCountState(state.chatText);
    if (chatState.status === 'error') {
      state.status = '聊天片段超过 3000 字，请删减后再分析。';
      render();
      return;
    }

    if (!state.baseResult) {
      generateBaseAnalysis();
    }

    var user = root.AuthUI && root.AuthUI.getCurrentUser ? root.AuthUI.getCurrentUser() : null;
    if (!user) {
      state.status = '请先登录后使用 AI 深度关系分析。';
      render();
      if (root.AuthUI && root.AuthUI.openModal) root.AuthUI.openModal('signin');
      return;
    }

    var client = root.SupabaseClient || null;
    if (!client || !client.functions || !client.functions.invoke) {
      state.status = 'Supabase 尚未配置，AI 分析暂时不可用。';
      render();
      return;
    }

    try {
      state.loading = true;
      state.status = 'AI 正在分析你们的关系节奏...';
      render();

      var response = await client.functions.invoke('generate-compatibility', {
        body: {
          signA: state.signA,
          signB: state.signB,
          relationshipType: state.relationshipType,
          chatText: state.chatText,
          baseResult: state.baseResult
        }
      });

      if (response.error) throw response.error;
      if (!response.data || !response.data.analysis) throw new Error('AI 分析结果为空');

      state.aiResult = response.data.analysis;
      state.status = 'AI 分析已生成。';
    } catch (error) {
      state.status = (error && error.message) ? error.message : 'AI 分析暂时失败，本次不扣除使用次数。';
    } finally {
      state.loading = false;
      render();
    }
  }

  return {
    render: render,
    CHAT_LIMIT: CHAT_LIMIT,
    RELATIONSHIP_TYPES: RELATIONSHIP_TYPES,
    getChatCountState: getChatCountState,
    buildBaseAnalysis: buildBaseAnalysis,
    __test: {
      getZodiacData: getZodiacData
    }
  };
});
