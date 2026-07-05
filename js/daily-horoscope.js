(function(root, factory) {
  var api = factory(root);
  if (root) root.DailyHoroscopeView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function(root) {
  'use strict';

  var STORAGE_KEY = 'hyp_daily_horoscope_sign';
  var DEFAULT_SIGN = 'aries';
  var SIGN_LABELS = {
    aries: '白羊座',
    taurus: '金牛座',
    gemini: '双子座',
    cancer: '巨蟹座',
    leo: '狮子座',
    virgo: '处女座',
    libra: '天秤座',
    scorpio: '天蝎座',
    sagittarius: '射手座',
    capricorn: '摩羯座',
    aquarius: '水瓶座',
    pisces: '双鱼座'
  };

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getStoredSign() {
    if (!root || !root.localStorage) return DEFAULT_SIGN;
    try {
      return root.localStorage.getItem(STORAGE_KEY) || DEFAULT_SIGN;
    } catch (error) {
      return DEFAULT_SIGN;
    }
  }

  function setStoredSign(sign) {
    if (!root || !root.localStorage) return;
    try {
      root.localStorage.setItem(STORAGE_KEY, sign);
    } catch (error) {
      // Ignore storage failures; the selector still works for this render.
    }
  }

  function buildSignOptions(selectedSign) {
    return Object.keys(SIGN_LABELS).map(function(sign) {
      var selected = sign === selectedSign ? ' selected' : '';
      return '<option value="' + sign + '"' + selected + '>' +
        escapeHtml(SIGN_LABELS[sign]) +
        '</option>';
    }).join('');
  }

  async function getLatestHoroscope(sign) {
    var client = root && root.SupabaseClient ? root.SupabaseClient : null;
    if (!client) return null;

    var result = await client
      .from('daily_horoscopes')
      .select('*')
      .eq('sign', sign)
      .eq('locale', 'en')
      .eq('is_published', true)
      .order('horoscope_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) return null;
    return result.data;
  }

  function renderShell(container, selectedSign) {
    container.innerHTML =
      '<section class="daily-horoscope-card" aria-live="polite">' +
        '<div class="daily-horoscope-head">' +
          '<div>' +
            '<p class="daily-horoscope-kicker">TODAY</p>' +
            '<h2>今日日运</h2>' +
          '</div>' +
          '<label class="daily-sign-picker">' +
            '<span>星座</span>' +
            '<select id="daily-horoscope-sign">' + buildSignOptions(selectedSign) + '</select>' +
          '</label>' +
        '</div>' +
        '<div class="daily-horoscope-body" id="daily-horoscope-body">' +
          '<p class="daily-horoscope-muted">正在读取今日星象...</p>' +
        '</div>' +
      '</section>';
  }

  function scoreItem(label, value) {
    if (value == null) return '';
    return '<span><strong>' + escapeHtml(value) + '</strong>' + escapeHtml(label) + '</span>';
  }

  function renderHoroscope(row) {
    var text = row.content_text_zh || row.content_text;
    var theme = row.theme_zh || row.theme;
    var insights = row.supporting_insights_zh && row.supporting_insights_zh.length
      ? row.supporting_insights_zh
      : (row.supporting_insights || []);
    var insightHtml = insights.slice(0, 2).map(function(item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');

    return (
      '<div class="daily-theme-row">' +
        '<span class="daily-date">' + escapeHtml(row.horoscope_date || '') + '</span>' +
        '<span class="daily-theme">' + escapeHtml(theme || '今日灵感') + '</span>' +
      '</div>' +
      '<p class="daily-horoscope-text">' + escapeHtml(text || '今日内容正在准备中。') + '</p>' +
      (insightHtml ? '<ul class="daily-insights">' + insightHtml + '</ul>' : '') +
      '<div class="daily-score-strip">' +
        scoreItem('综合', row.overall_score) +
        scoreItem('感情', row.love_score) +
        scoreItem('事业', row.career_score) +
        scoreItem('财富', row.money_score) +
        scoreItem('健康', row.health_score) +
      '</div>' +
      '<div class="daily-lucky-row">' +
        (row.lucky_color ? '<span>幸运色：' + escapeHtml(row.lucky_color) + '</span>' : '') +
        (row.lucky_number ? '<span>幸运数字：' + escapeHtml(row.lucky_number) + '</span>' : '') +
        (row.lucky_time_window ? '<span>幸运时段：' + escapeHtml(row.lucky_time_window) + '</span>' : '') +
      '</div>'
    );
  }

  async function loadAndRender(container, sign) {
    var body = container.querySelector('#daily-horoscope-body');
    if (!body) return;

    body.innerHTML = '<p class="daily-horoscope-muted">正在读取今日星象...</p>';
    var row = await getLatestHoroscope(sign);
    if (!row) {
      body.innerHTML = '<p class="daily-horoscope-muted">暂无可用星运数据，请稍后再来。</p>';
      return;
    }
    body.innerHTML = renderHoroscope(row);
  }

  function render(containerId) {
    if (!root || !root.document) return;
    var container = root.document.getElementById(containerId);
    if (!container) return;

    var selectedSign = getStoredSign();
    renderShell(container, selectedSign);
    loadAndRender(container, selectedSign);

    var select = container.querySelector('#daily-horoscope-sign');
    if (select) {
      select.addEventListener('change', function() {
        selectedSign = select.value || DEFAULT_SIGN;
        setStoredSign(selectedSign);
        loadAndRender(container, selectedSign);
      });
    }
  }

  return {
    render: render,
    getLatestHoroscope: getLatestHoroscope
  };
});
