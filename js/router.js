/**
 * Router Module (路由模块)
 * 基于hash的单页应用路由
 * 全局命名空间: Router
 *
 * 路由列表:
 *   #/            → 首页(浏览)
 *   #/sign/:id    → 星座详情
 *   #/starmap     → 星图
 *   #/favorites   → 收藏
 *   #/calculator  → 星座计算器
 */
window.Router = (function() {

  var routes = [];
  var notFoundHandler = null;

  /**
   * 注册路由
   * @param {string} pattern - 路由模式, 如 '#/sign/:id'
   * @param {function} handler - 处理函数, 接收params参数
   */
  function register(pattern, handler) {
    // 将路由模式转为正则表达式
    // '#/sign/:id' → /^#\/sign\/([^/]+)$/
    var paramNames = [];
    var regexStr = pattern.replace(/:([^/]+)/g, function(match, name) {
      paramNames.push(name);
      return '([^/]+)';
    });
    regexStr = '^' + regexStr + '$';

    routes.push({
      pattern: pattern,
      regex: new RegExp(regexStr),
      paramNames: paramNames,
      handler: handler
    });
  }

  /**
   * 设置404处理函数
   */
  function setNotFound(handler) {
    notFoundHandler = handler;
  }

  /**
   * 解析当前hash并路由
   */
  function dispatch() {
    var hash = window.location.hash || '#/';
    if (hash === '' || hash === '#') hash = '#/';

    var matched = false;

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var match = hash.match(route.regex);
      if (match) {
        var params = {};
        for (var j = 0; j < route.paramNames.length; j++) {
          params[route.paramNames[j]] = decodeURIComponent(match[j + 1]);
        }
        route.handler(params);
        matched = true;
        break;
      }
    }

    if (!matched && notFoundHandler) {
      notFoundHandler();
    }

    // 滚动到顶部
    window.scrollTo(0, 0);
  }

  /**
   * 导航到指定路径
   */
  function navigate(path) {
    if (path[0] !== '#') {
      path = '#' + path;
    }
    window.location.hash = path;
  }

  /**
   * 初始化路由
   */
  function init() {
    window.addEventListener('hashchange', dispatch);
    // 初始加载时触发
    if (!window.location.hash) {
      window.location.hash = '#/';
    } else {
      dispatch();
    }
  }

  /**
   * 获取当前路径
   */
  function current() {
    return window.location.hash || '#/';
  }

  return {
    register: register,
    setNotFound: setNotFound,
    dispatch: dispatch,
    navigate: navigate,
    init: init,
    current: current
  };
})();
