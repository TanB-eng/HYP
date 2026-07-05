/**
 * App Module (应用入口)
 * 初始化路由、视图切换、导航高亮、收藏徽章
 * 全局命名空间: App
 */
window.App = (function() {
  'use strict';

  var currentView = null;        // 当前视图名称
  var cleanupFn = null;          // 当前视图的清理函数

  // ============ 路由注册 ============
  function registerRoutes() {
    // 首页 → 浏览
    Router.register('#/', function() {
      switchView('browse');
      BrowseView.render();
    });

    // 星座详情
    Router.register('#/sign/:id', function(params) {
      switchView('detail');
      BrowseView.renderDetail(params.id);
    });

    // 星图
    Router.register('#/starmap', function() {
      switchView('starmap');
      StarMap.render();
    });

    // 收藏
    Router.register('#/favorites', function() {
      switchView('favorites');
      FavoritesView.render();
    });

    // 计算器
    Router.register('#/calculator', function() {
      switchView('calculator');
      CalculatorView.render();
    });

    // 手相
    Router.register('#/palm', function() {
      switchView('palm');
      PalmView.render();
    });

    // 404
    Router.setNotFound(function() {
      Router.navigate('#/');
    });
  }

  // ============ 视图切换 ============
  function switchView(viewName) {
    // 清理上一个视图
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = null;
    }

    // 如果离开星图视图，销毁canvas动画
    if (currentView === 'starmap' && viewName !== 'starmap') {
      if (window.StarMap && StarMap.destroy) {
        StarMap.destroy();
      }
    }

    // 如果离开手相视图，清理上传和Canvas事件
    if (currentView === 'palm' && viewName !== 'palm') {
      if (window.PalmView && PalmView.destroy) {
        PalmView.destroy();
      }
    }

    currentView = viewName;
    updateNavActive();
  }

  // ============ 导航高亮 ============
  function updateNavActive() {
    var hash = Router.current();
    var links = document.querySelectorAll('.nav-link');

    links.forEach(function(link) {
      var route = link.getAttribute('data-route');
      var isActive = false;

      if (route === '/' && (hash === '#/' || hash === '#')) {
        isActive = true;
      } else if (route === '/starmap' && hash.indexOf('#/starmap') === 0) {
        isActive = true;
      } else if (route === '/favorites' && hash.indexOf('#/favorites') === 0) {
        isActive = true;
      } else if (route === '/calculator' && hash.indexOf('#/calculator') === 0) {
        isActive = true;
      } else if (route === '/palm' && hash.indexOf('#/palm') === 0) {
        isActive = true;
      } else if (route === '/' && hash.indexOf('#/sign/') === 0) {
        // 详情页也算浏览导航
        isActive = true;
      }

      if (isActive) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // ============ 收藏徽章更新 ============
  function updateFavBadge() {
    var badge = document.getElementById('fav-badge');
    if (!badge) return;

    var count = Storage.Favorites.count();
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  // ============ 背景星空生成 ============
  function generateBgStars() {
    var bgLayer = document.querySelector('.bg-stars');
    if (!bgLayer) return;

    // 生成100个静态星星，用box-shadow技术
    var shadows = [];
    var w = window.innerWidth;
    var h = window.innerHeight;

    for (var i = 0; i < 100; i++) {
      var x = Math.floor(Math.random() * w);
      var y = Math.floor(Math.random() * h);
      var size = Math.random() > 0.8 ? 2 : 1;
      var alpha = 0.3 + Math.random() * 0.7;

      shadows.push(x + 'px ' + y + 'px 0 ' + size + 'px rgba(255,255,255,' + alpha.toFixed(2) + ')');
    }

    // 使用伪元素需要通过style标签注入
    var style = document.createElement('style');
    style.textContent = '.bg-stars::before {' +
      'content: ""; ' +
      'position: fixed; ' +
      'top: 0; left: 0; ' +
      'width: 1px; height: 1px; ' +
      'box-shadow: ' + shadows.join(', ') + '; ' +
      'pointer-events: none; ' +
      'z-index: 0; ' +
      'animation: twinkle 4s ease-in-out infinite alternate; ' +
      '}';
    document.head.appendChild(style);
  }

  // ============ 初始化 ============
  async function init() {
    var loading = document.getElementById('loading-state');

    if (window.Storage && Storage.init) {
      await Storage.init();
    }
    if (window.AuthUI && AuthUI.init) {
      await AuthUI.init();
    }
    if (window.Storage && Storage.ready) {
      await Storage.ready();
    }

    if (loading) {
      loading.remove();
    }

    registerRoutes();
    generateBgStars();
    updateFavBadge();

    window.addEventListener('favorites:changed', updateFavBadge);
    window.addEventListener('auth:changed', function() {
      if (!window.Storage || !Storage.ready) return;

      Storage.ready().then(function() {
        updateFavBadge();
        if (window.Router && Router.dispatch) {
          Router.dispatch();
        }
      });
    });

    var resizeTimer = null;
    window.addEventListener('resize', function() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        var styles = document.querySelectorAll('style');
        styles.forEach(function(s) {
          if (s.textContent.indexOf('.bg-stars') !== -1) {
            s.remove();
          }
        });
        generateBgStars();
      }, 500);
    });

    Router.init();
  }

  // ============ DOM Ready ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      init().catch(function(error) {
        console.error('应用初始化失败:', error);
      });
    });
  } else {
    init().catch(function(error) {
      console.error('应用初始化失败:', error);
    });
  }

  return {
    init: init
  };
})();
