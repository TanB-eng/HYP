/**
 * Browse View Module (星座浏览与详情模块) — 用户故事 US1
 * 提供黄道十二宫浏览网格视图与单个星座详情视图
 * 全局命名空间: BrowseView
 *
 * 依赖 (由其它文件以全局方式提供):
 *   - window.ZodiacData  : 星座数据层 (getAll / getById / getByElement / search / getCompatibility)
 *   - window.Storage     : 本地存储层 (Favorites.has / Favorites.toggle / Notes.get / Notes.set)
 *   - window.Router      : hash 路由 (navigate)
 *
 * 暴露方法:
 *   - BrowseView.render()            渲染浏览网格视图
 *   - BrowseView.renderDetail(id)    渲染某个星座的详情视图
 *   - BrowseView.toggleFavorite(id)  切换某个星座的收藏状态
 */
window.BrowseView = (function () {
  'use strict';

  // ============ 模块内部状态 ============
  var currentElement = '全部'; // 当前选中的元素筛选 (全部|火|土|风|水)
  var currentQuery = '';       // 当前搜索关键词
  var notesTimer = null;       // 笔记防抖计时器 (详情页)
  var toastTimer = null;       // toast 自动消失计时器

  // ============ 常量映射 ============

  // 四象元素 → 顶部色带 / 徽章所用的 CSS 变量
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
   * HTML 转义，避免笔记 / 数据中的特殊字符破坏结构
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
   * 显示短暂的 Toast 提示 (复用 components.css 中的 .toast 样式)
   * @param {string} message
   */
  function showToast(message) {
    // 移除可能存在的旧 toast，避免堆叠
    var old = document.getElementById('browse-toast');
    if (old && old.parentNode) {
      old.parentNode.removeChild(old);
    }

    var toast = document.createElement('div');
    toast.id = 'browse-toast';
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2000);
  }

  // ============ 浏览网格视图 ============

  /**
   * 渲染浏览网格视图，写入 #app-view
   */
  function render() {
    var app = document.getElementById('app-view');

    app.innerHTML =
      '<div class="view-browse animate-fade-in">' +
        '<div class="browse-header">' +
          '<h1 class="view-title">黄道十二宫</h1>' +
          '<p class="view-subtitle">探索十二星座的奥秘</p>' +
        '</div>' +
        '<div class="browse-controls">' +
          '<input type="text" class="search-input" id="search-input" placeholder="搜索星座名称或关键词...">' +
          '<div class="filter-bar">' +
            '<button class="filter-btn active" data-element="全部">全部</button>' +
            '<button class="filter-btn" data-element="火">火象</button>' +
            '<button class="filter-btn" data-element="土">土象</button>' +
            '<button class="filter-btn" data-element="风">风象</button>' +
            '<button class="filter-btn" data-element="水">水象</button>' +
          '</div>' +
        '</div>' +
        '<div class="sign-grid" id="sign-grid">' +
          '<!-- 星座卡片在此处生成 -->' +
        '</div>' +
        '<div class="empty-state hidden" id="no-results">' +
          '<span class="empty-icon">🔭</span>' +
          '<p>未找到匹配的星座</p>' +
        '</div>' +
      '</div>';

    // 重置筛选状态 (每次进入浏览页都从"全部 / 无搜索词"开始)
    currentElement = '全部';
    currentQuery = '';

    // 初次渲染全部星座卡片
    applyFilter();

    // ---- 绑定搜索输入: 实时过滤 ----
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        currentQuery = searchInput.value;
        applyFilter();
      });
    }

    // ---- 绑定筛选按钮: 切换激活态并重新过滤 ----
    var filterBtns = document.querySelectorAll('.filter-btn');
    for (var i = 0; i < filterBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          // 移除所有按钮的 active
          var allBtns = document.querySelectorAll('.filter-btn');
          for (var j = 0; j < allBtns.length; j++) {
            allBtns[j].classList.remove('active');
          }
          // 激活当前按钮
          btn.classList.add('active');
          currentElement = btn.getAttribute('data-element');
          applyFilter();
        });
      })(filterBtns[i]);
    }
  }

  /**
   * 应用筛选 (元素 + 搜索) 并渲染网格
   * 策略: 先按元素过滤，再在结果集中做搜索匹配
   */
  function applyFilter() {
    var grid = document.getElementById('sign-grid');
    var noResults = document.getElementById('no-results');
    if (!grid || !noResults) return;

    // 1. 先按元素过滤
    var results;
    if (currentElement === '全部') {
      results = window.ZodiacData.getAll();
    } else {
      results = window.ZodiacData.getByElement(currentElement);
    }

    // 2. 在元素结果集中再搜索 (与 ZodiacData.search 的匹配结果取交集)
    var query = currentQuery.trim();
    if (query) {
      var searched = window.ZodiacData.search(query) || [];
      var matchIds = {};
      for (var i = 0; i < searched.length; i++) {
        matchIds[searched[i].id] = true;
      }
      results = results.filter(function (s) {
        return !!matchIds[s.id];
      });
    }

    // 3. 渲染卡片或空状态
    if (!results || results.length === 0) {
      grid.innerHTML = '';
      noResults.classList.remove('hidden');
    } else {
      noResults.classList.add('hidden');
      var html = '';
      for (var k = 0; k < results.length; k++) {
        html += renderCard(results[k]);
      }
      grid.innerHTML = html;
    }
  }

  /**
   * 生成单个星座卡片的 HTML
   * @param {Object} sign - 星座数据对象
   * @returns {string}
   */
  function renderCard(sign) {
    var isFav = window.Storage.Favorites.has(sign.id);
    // 已收藏的卡片显示金色星标 (复用 .fav-mark / .is-favorited 样式)
    var favMark = isFav ? '<span class="fav-mark">★</span>' : '';
    var cardClass = 'sign-card' + (isFav ? ' is-favorited' : '');

    return (
      '<div class="' + cardClass + '" ' +
        'data-id="' + sign.id + '" data-element="' + sign.element + '" ' +
        'onclick="Router.navigate(\'#/sign/' + sign.id + '\')">' +
        '<div class="card-top-bar" style="background: ' + elementColor(sign.element) + '"></div>' +
        '<div class="card-body">' +
          '<div class="symbol">' + sign.symbol + '</div>' +
          '<h3 class="name-cn">' + escapeHtml(sign.name_cn) + '</h3>' +
          '<p class="name-en">' + escapeHtml(sign.name_en) + '</p>' +
          '<p class="date-range">' + escapeHtml(sign.date_range) + '</p>' +
          '<span class="element-badge" data-element="' + sign.element + '">' + elementLabel(sign.element) + '</span>' +
          favMark +
        '</div>' +
      '</div>'
    );
  }

  // ============ 星座详情视图 ============

  /**
   * 渲染某个星座的详情视图
   * @param {string} id - 星座 ID, 如 'aries'
   */
  function renderDetail(id) {
    var app = document.getElementById('app-view');
    var sign = window.ZodiacData.getById(id);

    // ---- 未找到星座: 显示提示与返回按钮 ----
    if (!sign) {
      app.innerHTML =
        '<div class="view-detail animate-fade-in">' +
          '<button class="back-btn" onclick="Router.navigate(\'#/\')"><span class="arrow">←</span> 返回列表</button>' +
          '<div class="empty-state">' +
            '<span class="empty-icon">🔭</span>' +
            '<p>未找到该星座</p>' +
          '</div>' +
        '</div>';
      return;
    }

    // ---- 收藏状态 ----
    var isFav = window.Storage.Favorites.has(sign.id);
    var favIcon = isFav ? '★' : '☆';
    var favText = isFav ? '已收藏' : '收藏';
    var favClass = isFav ? 'favorite-btn active' : 'favorite-btn';

    // ---- 笔记内容 ----
    var note = window.Storage.Notes.get(sign.id) || '';

    // ---- 性格特点 trait 徽章 ----
    var traitsHtml = '';
    if (sign.traits && sign.traits.length) {
      for (var i = 0; i < sign.traits.length; i++) {
        traitsHtml += '<span class="trait-badge">' + escapeHtml(sign.traits[i]) + '</span>';
      }
    }

    // ---- 幸运信息 ----
    var luckyNumbers = (sign.lucky_numbers || []).join(', ');
    var luckyColors = (sign.lucky_colors || []).join(', ');
    var luckyStones = (sign.lucky_stones || []).join(', ');

    // ---- 配对卡片 ----
    var compatHtml = renderCompatibility(sign);

    app.innerHTML =
      '<div class="view-detail animate-fade-in">' +
        '<button class="back-btn" onclick="Router.navigate(\'#/\')"><span class="arrow">←</span> 返回列表</button>' +
        '<div class="detail-view">' +

          /* ===== 主栏 ===== */
          '<div class="detail-main">' +

            /* 详情头部 */
            '<div class="detail-header" data-element="' + sign.element + '">' +
              '<div class="detail-symbol">' + sign.symbol + '</div>' +
              '<h1>' + escapeHtml(sign.name_cn) + '</h1>' +
              '<p class="detail-name-en">' + escapeHtml(sign.name_en) + '</p>' +
              '<p class="detail-date">' + escapeHtml(sign.date_range) + '</p>' +
              '<div class="detail-badges">' +
                '<span class="info-badge" data-element="' + sign.element + '">' + elementLabel(sign.element) + '</span>' +
                '<span class="info-badge">' + modalityLabel(sign.modality) + '</span>' +
                '<span class="info-badge">守护星: ' + escapeHtml(sign.ruling_planet) + '</span>' +
              '</div>' +
            '</div>' +

            /* 收藏按钮 */
            '<button class="' + favClass + '" id="fav-btn" onclick="BrowseView.toggleFavorite(\'' + sign.id + '\')">' +
              '<span class="fav-icon">' + favIcon + '</span> ' + favText +
            '</button>' +

            /* 笔记区 */
            '<div class="notes-section">' +
              '<h3>我的笔记</h3>' +
              '<textarea class="notes-area" id="notes-area" placeholder="在这里记录你对这个星座的观察和想法..." rows="4">' + escapeHtml(note) + '</textarea>' +
              '<span class="save-indicator" id="save-indicator"></span>' +
            '</div>' +

            /* 性格特点 */
            '<div class="detail-section">' +
              '<h3>性格特点</h3>' +
              '<div class="traits-list">' + traitsHtml + '</div>' +
              '<p class="section-content">' + escapeHtml(sign.personality) + '</p>' +
            '</div>' +

            /* 神话传说 */
            '<div class="detail-section">' +
              '<h3>神话传说</h3>' +
              '<p class="section-content">' + escapeHtml(sign.mythology) + '</p>' +
            '</div>' +

          '</div>' +  /* /.detail-main */

          /* ===== 侧边栏 ===== */
          '<div class="detail-sidebar">' +

            /* 幸运信息 */
            '<div class="detail-section">' +
              '<h3>幸运信息</h3>' +
              '<ul>' +
                '<li>幸运数字: ' + escapeHtml(luckyNumbers) + '</li>' +
                '<li>幸运颜色: ' + escapeHtml(luckyColors) + '</li>' +
                '<li>幸运宝石: ' + escapeHtml(luckyStones) + '</li>' +
              '</ul>' +
            '</div>' +

            /* 星座配对 */
            '<div class="detail-section">' +
              '<h3>星座配对</h3>' +
              compatHtml +
            '</div>' +

            /* 掌管身体 */
            '<div class="detail-section">' +
              '<h3>掌管身体</h3>' +
              '<p>' + escapeHtml(sign.body_parts) + '</p>' +
            '</div>' +

          '</div>' +  /* /.detail-sidebar */

        '</div>' +  /* /.detail-view */
      '</div>';  /* /.view-detail */

    // ---- 绑定笔记输入: 防抖自动保存 ----
    bindNotesAutosave(sign.id);
  }

  /**
   * 生成星座配对卡片 HTML
   * 每个配对星座渲染为可点击的小卡片，点击跳转到对应详情页
   * @param {Object} sign - 当前星座
   * @returns {string}
   */
  function renderCompatibility(sign) {
    var compat = window.ZodiacData.getCompatibility(sign.id) || [];

    if (compat.length === 0) {
      return '<p class="section-content">暂无配对信息</p>';
    }

    var html = '<div class="compat-list">';
    for (var i = 0; i < compat.length; i++) {
      var c = compat[i];
      html +=
        '<div class="compat-card" onclick="Router.navigate(\'#/sign/' + c.id + '\')">' +
          '<div class="compat-symbol">' + c.symbol + '</div>' +
          '<div class="compat-info">' +
            '<span class="compat-name">' + escapeHtml(c.name_cn) + '</span>' +
            '<span class="compat-element" style="color: ' + elementColor(c.element) + '">' + elementLabel(c.element) + '</span>' +
          '</div>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * 绑定笔记区的防抖自动保存
   * 输入停止 500ms 后保存，并在 #save-indicator 显示"已保存"
   * @param {string} id - 星座 ID
   */
  function bindNotesAutosave(id) {
    var notesArea = document.getElementById('notes-area');
    if (!notesArea) return;

    notesArea.addEventListener('input', function () {
      // 清除上一个计时器，实现防抖
      if (notesTimer) {
        clearTimeout(notesTimer);
      }
      notesTimer = setTimeout(function () {
        // 保存笔记
        window.Storage.Notes.set(id, notesArea.value);

        // 显示"已保存"提示
        var indicator = document.getElementById('save-indicator');
        if (indicator) {
          indicator.textContent = '已保存';
          indicator.classList.add('visible');
          // 2 秒后淡出提示文字
          setTimeout(function () {
            var ind = document.getElementById('save-indicator');
            if (ind) {
              ind.classList.remove('visible');
            }
          }, 2000);
        }
      }, 500);
    });
  }

  // ============ 收藏切换 ============

  /**
   * 切换某个星座的收藏状态
   *   1. 调用 Storage.Favorites.toggle 切换
   *   2. 更新按钮图标 (☆↔★) 与 active 样式
   *   3. 弹出 Toast 提示 "已收藏" / "已取消收藏"
   * @param {string} id - 星座 ID
   */
  function toggleFavorite(id) {
    var nowFav = window.Storage.Favorites.toggle(id);

    // 更新按钮 UI (重建内部内容以同步图标与文案，onclick 绑定在按钮属性上不受影响)
    var btn = document.getElementById('fav-btn');
    if (btn) {
      btn.innerHTML =
        '<span class="fav-icon">' + (nowFav ? '★' : '☆') + '</span> ' +
        (nowFav ? '已收藏' : '收藏');
      if (nowFav) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }

    // Toast 提示
    showToast(nowFav ? '已收藏' : '已取消收藏');
  }

  // ============ 导出公共 API ============
  return {
    render: render,
    renderDetail: renderDetail,
    toggleFavorite: toggleFavorite
  };
})();
