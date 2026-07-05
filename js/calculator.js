/**
 * Calculator View Module (星座计算器模块) — 用户故事 US4
 * 根据用户输入的生日 (月、日) 计算所属星座，并展示结果卡片
 * 若生日处于两个星座的交界处 (边界日期)，同时展示两个星座供用户参考
 * 全局命名空间: CalculatorView
 *
 * 依赖 (由其它文件以全局方式提供):
 *   - window.ZodiacData  : 星座数据层 (getByDate)
 *   - window.Router      : hash 路由 (navigate)
 *
 * 暴露方法:
 *   - CalculatorView.render()  渲染计算器视图，绑定下拉框与按钮事件
 */
window.CalculatorView = (function () {
  'use strict';

  // ============ 常量映射 ============

  // 各月份对应的天数 (二月按 29 天处理，兼容闰年)
  var MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // 四象元素 → CSS 变量色 (用于徽章文字颜色)
  var ELEMENT_COLORS = {
    '火': 'var(--element-fire)',
    '土': 'var(--element-earth)',
    '风': 'var(--element-air)',
    '水': 'var(--element-water)'
  };

  // 四象元素 → 显示名称
  var ELEMENT_LABELS = {
    '火': '火象',
    '土': '土象',
    '风': '风象',
    '水': '水象'
  };

  // 模态性 → 显示名称 (追加"宫"字)
  var MODALITY_LABELS = {
    '基本': '基本宫',
    '固定': '固定宫',
    '变动': '变动宫'
  };

  // ============ 工具函数 ============

  /**
   * HTML 转义，避免数据中的特殊字符破坏结构
   * @param {*} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 取元素的 CSS 变量色 (兜底为火象色) */
  function elementColor(el) {
    return ELEMENT_COLORS[el] || 'var(--element-fire)';
  }

  /** 取元素的显示名称 */
  function elementLabel(el) {
    return ELEMENT_LABELS[el] || el;
  }

  /** 取模态性的显示名称 */
  function modalityLabel(mod) {
    return MODALITY_LABELS[mod] || mod;
  }

  /**
   * 截取 personality 的前 120 个字符并追加省略号
   * @param {string} personality
   * @returns {string}
   */
  function truncatePersonality(personality) {
    if (!personality) return '';
    if (personality.length <= 120) return escapeHtml(personality);
    return escapeHtml(personality.substring(0, 120)) + '...';
  }

  // ============ 渲染主视图 ============

  /**
   * 渲染计算器视图，写入 #app-view，并绑定所有交互事件
   */
  function render() {
    var app = document.getElementById('app-view');

    app.innerHTML =
      '<div class="view-calculator animate-fade-in">' +
        '<div class="calculator-header">' +
          '<h1 class="view-title">星座计算器</h1>' +
          '<p class="view-subtitle">输入你的生日，查看你的星座</p>' +
        '</div>' +
        '<div class="calculator-card">' +
          '<div class="date-input-group">' +
            '<div class="select-group">' +
              '<label for="month-select">月份</label>' +
              '<select id="month-select" class="date-select">' +
                '<option value="">选择月份</option>' +
                buildMonthOptions() +
              '</select>' +
            '</div>' +
            '<div class="select-group">' +
              '<label for="day-select">日期</label>' +
              '<select id="day-select" class="date-select">' +
                '<option value="">选择日期</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<button class="calculate-btn" id="calculate-btn">查询星座</button>' +
          '<button class="today-btn" id="today-btn">今天</button>' +
          '<div class="error-msg" id="error-msg" style="display:none;"></div>' +
        '</div>' +
        '<div class="result-container" id="result-container">' +
          '<!-- 结果卡片在计算后生成 -->' +
        '</div>' +
      '</div>';

    // ---- 绑定月份下拉框: 选择月份后填充对应天数 ----
    var monthSelect = document.getElementById('month-select');
    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        populateDays(monthSelect.value);
        clearError();
      });
      // Enter 键触发查询
      monthSelect.addEventListener('keydown', onEnterKey);
    }

    // ---- 绑定日期下拉框: 修改日期时清除错误提示 ----
    var daySelect = document.getElementById('day-select');
    if (daySelect) {
      daySelect.addEventListener('change', function () {
        clearError();
      });
      // Enter 键触发查询
      daySelect.addEventListener('keydown', onEnterKey);
    }

    // ---- 绑定查询按钮 ----
    var calcBtn = document.getElementById('calculate-btn');
    if (calcBtn) {
      calcBtn.addEventListener('click', calculate);
    }

    // ---- 绑定今天按钮 ----
    var todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', useToday);
    }
  }

  /**
   * 构建月份选项 1-12 的 HTML
   * @returns {string}
   */
  function buildMonthOptions() {
    var html = '';
    for (var m = 1; m <= 12; m++) {
      html += '<option value="' + m + '">' + m + '月</option>';
    }
    return html;
  }

  /**
   * 根据所选月份填充日期下拉框 (1 ~ maxDays)
   * @param {string} monthValue - 月份下拉框的值 (空字符串表示未选择)
   */
  function populateDays(monthValue) {
    var daySelect = document.getElementById('day-select');
    if (!daySelect) return;

    // 先重置为占位符
    daySelect.innerHTML = '<option value="">选择日期</option>';

    if (!monthValue) return;

    var month = parseInt(monthValue, 10);
    var maxDays = MONTH_DAYS[month - 1] || 30;

    for (var d = 1; d <= maxDays; d++) {
      daySelect.innerHTML += '<option value="' + d + '">' + d + '日</option>';
    }
  }

  // ============ 交互事件 ============

  /**
   * Enter 键监听: 在下拉框上按 Enter 时触发查询
   * @param {KeyboardEvent} e
   */
  function onEnterKey(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      calculate();
    }
  }

  /**
   * "今天"按钮: 用当前日期填充下拉框并自动查询
   */
  function useToday() {
    var now = new Date();
    var month = now.getMonth() + 1; // getMonth 返回 0-11
    var day = now.getDate();

    var monthSelect = document.getElementById('month-select');
    var daySelect = document.getElementById('day-select');
    if (!monthSelect || !daySelect) return;

    // 设置月份并填充天数
    monthSelect.value = String(month);
    populateDays(String(month));
    // 设置日期
    daySelect.value = String(day);

    clearError();
    calculate();
  }

  /**
   * "查询星座"按钮: 读取下拉框值，校验后调用数据层并渲染结果
   */
  function calculate() {
    var monthSelect = document.getElementById('month-select');
    var daySelect = document.getElementById('day-select');
    if (!monthSelect || !daySelect) return;

    var monthVal = monthSelect.value;
    var dayVal = daySelect.value;

    // ---- 校验: 月份和日期都必须选择 ----
    if (!monthVal || !dayVal) {
      showError('请选择完整的出生日期');
      return;
    }

    var month = parseInt(monthVal, 10);
    var day = parseInt(dayVal, 10);

    // ---- 调用数据层获取星座 ----
    var result = window.ZodiacData.getByDate(month, day);

    // ---- sign 为空表示无法确定星座 ----
    if (!result || !result.sign) {
      showError('无法确定星座，请检查日期');
      return;
    }

    // ---- 校验通过，清除错误并渲染结果 ----
    clearError();

    var container = document.getElementById('result-container');
    if (!container) return;

    // ---- 边界星座: 同时展示两个星座 ----
    if (result.cusp) {
      container.innerHTML = renderCuspCard(result.sign, result.cusp);
    } else {
      container.innerHTML = renderResultCard(result.sign);
    }
  }

  // ============ 结果卡片渲染 ============

  /**
   * 渲染单个星座的结果卡片
   * @param {Object} sign - 星座数据对象
   * @returns {string}
   */
  function renderResultCard(sign) {
    return (
      '<div class="result-card animate-fade-in">' +
        '<div class="result-symbol">' + sign.symbol + '</div>' +
        '<h2 class="result-name">' + escapeHtml(sign.name_cn) + '</h2>' +
        '<p class="result-name-en">' + escapeHtml(sign.name_en) + '</p>' +
        '<p class="result-date">' + escapeHtml(sign.date_range) + '</p>' +
        '<div class="result-badges">' +
          '<span class="info-badge" style="color: ' + elementColor(sign.element) + '">' + elementLabel(sign.element) + '</span>' +
          '<span class="info-badge">' + modalityLabel(sign.modality) + '</span>' +
        '</div>' +
        '<p class="result-description">' + truncatePersonality(sign.personality) + '</p>' +
        '<button class="view-detail-btn" onclick="Router.navigate(\'#/sign/' + sign.id + '\')">查看详情 →</button>' +
      '</div>'
    );
  }

  /**
   * 渲染边界星座卡片 (同时展示主星座与相邻星座)
   * @param {Object} primary   - 主星座数据对象
   * @param {Object} secondary - 相邻星座数据对象
   * @returns {string}
   */
  function renderCuspCard(primary, secondary) {
    return (
      '<div class="result-card cusp-result animate-fade-in">' +
        '<div class="cusp-label">⭐ 边界星座</div>' +
        '<p class="cusp-hint">你的生日处于两个星座的交界处</p>' +
        '<div class="cusp-signs">' +
          renderCuspSign(primary, 'primary') +
          '<div class="cusp-divider">或</div>' +
          renderCuspSign(secondary, 'secondary') +
        '</div>' +
      '</div>'
    );
  }

  /**
   * 渲染边界卡片中的单个星座区块
   * @param {Object} sign      - 星座数据对象
   * @param {string} position  - 'primary' | 'secondary'
   * @returns {string}
   */
  function renderCuspSign(sign, position) {
    return (
      '<div class="cusp-sign ' + position + '">' +
        '<div class="result-symbol">' + sign.symbol + '</div>' +
        '<h3>' + escapeHtml(sign.name_cn) + '</h3>' +
        '<p>' + escapeHtml(sign.date_range) + '</p>' +
        '<button onclick="Router.navigate(\'#/sign/' + sign.id + '\')">查看详情</button>' +
      '</div>'
    );
  }

  // ============ 错误提示 ============

  /**
   * 显示错误信息 (display:block)
   * @param {string} message
   */
  function showError(message) {
    var errEl = document.getElementById('error-msg');
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
    }
  }

  /**
   * 清除错误信息 (隐藏)
   */
  function clearError() {
    var errEl = document.getElementById('error-msg');
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  // ============ 导出公共 API ============
  return {
    render: render
  };
})();
