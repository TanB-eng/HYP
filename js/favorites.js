/**
 * Favorites View Module (收藏与笔记模块) — 用户故事 US3
 * 提供收藏列表视图、笔记即时编辑、笔记导出与一键清空功能
 * 全局命名空间: FavoritesView
 *
 * 依赖 (由其它文件以全局方式提供):
 *   - window.ZodiacData  : 星座数据层 (getAll / getById)
 *   - window.Storage     : 本地存储层 (Favorites / Notes / clearAll)
 *   - window.Router      : hash 路由 (navigate)
 *
 * 暴露方法:
 *   - FavoritesView.render()  渲染收藏视图并绑定全部事件
 */
window.FavoritesView = (function () {
  'use strict';

  // ============ 模块内部状态 ============
  var notesTimers = {};    // 笔记防抖计时器 (按星座ID索引，支持多卡片并行防抖)
  var statusTimers = {};   // "已保存"提示淡出计时器 (按星座ID索引)
  var toastTimer = null;   // toast 自动消失计时器

  // ============ 常量映射 ============

  // 四象元素 → CSS 变量色 (徽章 / 指示器所用)
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

  function getExportSignLabel(sign, id) {
    if (!sign) return id || '未知星座';
    return sign.name_cn + ' ' + sign.name_en;
  }

  function formatNotesText(favorites, notes) {
    var favList = Array.isArray(favorites) ? favorites.slice() : [];
    var noteMap = notes || {};
    var noteIds = Object.keys(noteMap).filter(function(id) {
      return favList.indexOf(id) === -1;
    });
    var ids = favList.concat(noteIds);
    var lines = [
      'HYP星座研究 - 收藏笔记导出',
      '导出时间：' + new Date().toISOString(),
      '========================================',
      ''
    ];

    if (!ids.length) {
      lines.push('暂无收藏或笔记。');
      return lines.join('\n');
    }

    ids.forEach(function(id, index) {
      var sign = window.ZodiacData && window.ZodiacData.getById
        ? window.ZodiacData.getById(id)
        : null;
      var note = noteMap[id] && String(noteMap[id]).trim()
        ? String(noteMap[id]).trim()
        : '暂无笔记';

      lines.push((index + 1) + '. ' + getExportSignLabel(sign, id));
      if (sign) {
        lines.push('日期：' + sign.date_range);
        lines.push('元素：' + elementLabel(sign.element));
      }
      lines.push('笔记：');
      lines.push(note);
      lines.push('----------------------------------------');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * 显示短暂的 Toast 提示 (复用 components.css 中的 .toast 样式)
   * @param {string} message
   */
  function showToast(message) {
    // 移除可能存在的旧 toast，避免堆叠
    var old = document.getElementById('fav-toast');
    if (old && old.parentNode) {
      old.parentNode.removeChild(old);
    }

    var toast = document.createElement('div');
    toast.id = 'fav-toast';
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      var t = document.getElementById('fav-toast');
      if (t && t.parentNode) {
        t.parentNode.removeChild(t);
      }
    }, 2000);
  }

  // ============ 收藏项渲染 ============

  /**
   * 生成单个收藏项的 HTML
   * @param {Object} sign - 星座数据对象
   * @returns {string}
   */
  function renderFavoriteItem(sign) {
    // 笔记内容与是否存在笔记
    var noteText = window.Storage.Notes.get(sign.id) || '';
    var hasNote = window.Storage.Notes.has(sign.id);

    // 笔记指示器: 已有笔记的星座在名称旁显示小圆点，颜色取元素色
    var noteIndicator = hasNote
      ? '<span class="note-indicator" title="已添加笔记" style="color: ' + elementColor(sign.element) + '">●</span>'
      : '';

    return (
      '<div class="favorite-item" data-id="' + sign.id + '">' +
        '<div class="fav-item-header">' +
          '<span class="fav-symbol">' + sign.symbol + '</span>' +
          '<div class="fav-info">' +
            '<h3 class="fav-name">' + escapeHtml(sign.name_cn) +
              ' <span class="fav-name-en">' + escapeHtml(sign.name_en) + '</span>' +
              noteIndicator +
            '</h3>' +
            '<p class="fav-date">' + escapeHtml(sign.date_range) + '</p>' +
            '<span class="element-badge" data-element="' + sign.element + '">' + elementLabel(sign.element) + '</span>' +
          '</div>' +
          '<div class="fav-actions">' +
            '<button class="view-detail-btn" onclick="Router.navigate(\'#/sign/' + sign.id + '\')">查看详情</button>' +
            '<button class="unfav-btn" data-id="' + sign.id + '">取消收藏</button>' +
          '</div>' +
        '</div>' +
        '<div class="note-editor">' +
          '<textarea class="notes-area" data-id="' + sign.id + '" placeholder="记录你对' + escapeHtml(sign.name_cn) + '的观察..." rows="3">' + escapeHtml(noteText) + '</textarea>' +
          '<div class="note-footer">' +
            '<span class="char-count">' + noteText.length + ' 字</span>' +
            '<span class="save-status" data-id="' + sign.id + '"></span>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ============ 主渲染 ============

  /**
   * 渲染收藏视图，写入 #app-view
   * 1. 读取收藏列表，逐个查取星座数据 (数据不存在的ID静默跳过)
   * 2. 列表为空时显示空状态、隐藏列表；反之隐藏空状态、显示列表
   * 3. 渲染完成后绑定全部事件监听
   */
  function render() {
    var app = document.getElementById('app-view');
    if (!app) return;

    var favorites = window.Storage.Favorites.getAll();

    // 构建收藏项 HTML (跳过数据中已不存在的星座ID)
    var itemsHtml = '';
    for (var i = 0; i < favorites.length; i++) {
      var sign = window.ZodiacData.getById(favorites[i]);
      if (!sign) continue; // 星座数据不存在则静默跳过
      itemsHtml += renderFavoriteItem(sign);
    }

    // 以实际渲染出的项为准判断是否有收藏
    // (即使收藏列表非空，但所有ID均失效时也应显示空状态)
    var hasFavorites = itemsHtml !== '';

    app.innerHTML =
      '<div class="view-favorites animate-fade-in">' +
        '<div class="favorites-header">' +
          '<h1 class="view-title">我的收藏</h1>' +
          '<p class="view-subtitle">你收藏的星座和个人笔记</p>' +
        '</div>' +
        '<div class="favorites-actions">' +
          '<button class="export-btn" id="export-btn">导出笔记</button>' +
          '<button class="clear-btn" id="clear-btn">清空全部</button>' +
        '</div>' +
        '<div class="favorites-list' + (hasFavorites ? '' : ' hidden') + '" id="favorites-list">' +
          itemsHtml +
        '</div>' +
        '<div class="empty-state' + (hasFavorites ? ' hidden' : '') + '" id="fav-empty">' +
          '<span class="empty-icon">★</span>' +
          '<p>你还没有收藏任何星座</p>' +
          '<p class="empty-hint">在星座详情页点击收藏按钮即可添加</p>' +
          '<button class="back-btn" onclick="Router.navigate(\'#/\')">去浏览星座</button>' +
        '</div>' +
      '</div>';

    // innerHTML 设置完毕，绑定事件
    bindEvents();
  }

  // ============ 事件绑定 ============

  /**
   * 绑定收藏页全部事件 (在 innerHTML 写入后调用)
   */
  function bindEvents() {
    bindNotesAutosave();
    bindUnfavButtons();
    bindExportButton();
    bindClearButton();
  }

  /**
   * 绑定笔记区防抖自动保存
   * 每个 textarea 独立防抖:
   *   - input 事件实时更新字数
   *   - 输入停止 500ms 后调用 Storage.Notes.set 保存
   *   - 保存后在 .save-status 显示"已保存"，2 秒后淡出
   */
  function bindNotesAutosave() {
    var textareas = document.querySelectorAll('.notes-area');
    for (var i = 0; i < textareas.length; i++) {
      (function (ta) {
        var id = ta.getAttribute('data-id');

        ta.addEventListener('input', function () {
          // ---- 实时更新字数 ----
          var editor = ta.parentNode; // .note-editor
          var charCount = editor.querySelector('.char-count');
          if (charCount) {
            charCount.textContent = ta.value.length + ' 字';
          }

          // ---- 防抖保存 (500ms) ----
          if (notesTimers[id]) {
            clearTimeout(notesTimers[id]);
          }
          notesTimers[id] = setTimeout(function () {
            // 保存笔记 (空文本会自动删除该条笔记)
            window.Storage.Notes.set(id, ta.value);

            // 显示"已保存"提示
            var status = document.querySelector('.save-status[data-id="' + id + '"]');
            if (status) {
              status.textContent = '已保存';
              status.classList.add('visible');

              // 2 秒后淡出 (移除 visible 类，由 CSS 过渡控制透明度)
              if (statusTimers[id]) {
                clearTimeout(statusTimers[id]);
              }
              statusTimers[id] = setTimeout(function () {
                var s = document.querySelector('.save-status[data-id="' + id + '"]');
                if (s) {
                  s.classList.remove('visible');
                }
              }, 2000);
            }
          }, 500);
        });
      })(textareas[i]);
    }
  }

  /**
   * 绑定取消收藏按钮
   * 点击后调用 Storage.Favorites.toggle 移除收藏并重新渲染
   * 笔记数据保留在存储中，不受取消收藏影响
   */
  function bindUnfavButtons() {
    var btns = document.querySelectorAll('.unfav-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          // toggle 返回 false 表示已取消收藏
          window.Storage.Favorites.toggle(id);
          // 重新渲染列表
          // (favorites:changed 事件也会触发渲染，此处显式调用以确保即时更新)
          render();
        });
      })(btns[i]);
    }
  }

  /**
   * 绑定导出笔记按钮
   * 将全部收藏与笔记导出为普通文本文件并触发下载
   */
  function bindExportButton() {
    var btn = document.getElementById('export-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var text = formatNotesText(
        window.Storage.Favorites.getAll(),
        window.Storage.Notes.getAll()
      );

      // 创建 Blob 与临时下载链接
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'zodiac-notes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 释放对象 URL
      URL.revokeObjectURL(url);

      showToast('笔记已导出');
    });
  }

  /**
   * 绑定清空全部按钮
   * 弹出确认对话框，确认后清空所有收藏和笔记并重新渲染
   */
  function bindClearButton() {
    var btn = document.getElementById('clear-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var confirmed = window.confirm('确定要清空所有收藏和笔记吗？此操作不可撤销。');
      if (!confirmed) return;

      // 清空全部收藏与笔记
      window.Storage.clearAll();
      // 重新渲染 (显示空状态)
      render();
      showToast('已清空全部数据');
    });
  }

  // ============ 监听收藏变化 ============

  // 当从详情页等处切换收藏状态时，若当前处于收藏页则自动重新渲染
  // 保持视图与存储同步
  window.addEventListener('favorites:changed', function () {
    var hash = window.location.hash || '#/';
    if (hash === '#/favorites') {
      render();
    }
  });

  // ============ 导出公共 API ============
  return {
    render: render,
    formatNotesText: formatNotesText
  };
})();
