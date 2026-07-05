/**
 * Star Map Module (星图模块) — 用户故事 US2
 * 黄道十二宫星盘 Canvas 交互式可视化
 * 全局命名空间: StarMap
 *
 * 依赖 (由其它文件以全局方式提供):
 *   - window.ZodiacData  : 星座数据层 (getAll / getById)
 *   - window.Router      : hash 路由 (navigate)
 *
 * 暴露方法:
 *   - StarMap.render()          渲染星图容器 HTML 并初始化画布
 *   - StarMap.init(canvasId)    设置画布并启动动画循环
 *   - StarMap.destroy()         停止动画并清理事件监听 (SPA 视图切换时调用)
 */
window.StarMap = (function () {
  'use strict';

  // ============ 模块内部状态 ============

  var canvas = null;       // Canvas DOM 元素
  var ctx = null;          // 2D 渲染上下文
  var container = null;    // 画布父容器 (.starmap-container)
  var tooltip = null;      // 工具提示 DOM 元素
  var animationId = null;  // requestAnimationFrame 返回 ID
  var resizeTimer = null;  // resize 防抖计时器

  var stars = [];          // 背景星空星星数组
  var signs = null;        // 缓存的十二星座数据 (避免每帧调用 getAll)
  var hoveredSector = -1;  // 当前悬停的扇区索引 (0-11), -1 表示无悬停
  var mouseX = 0;          // 鼠标逻辑 X 坐标 (CSS 像素)
  var mouseY = 0;          // 鼠标逻辑 Y 坐标 (CSS 像素)

  var logicalWidth = 0;    // 画布逻辑宽度 (CSS 像素, 用于计算)
  var logicalHeight = 0;   // 画布逻辑高度 (CSS 像素, 用于计算)
  var dpr = 1;             // 设备像素比 (Retina 屏 > 1)

  // 事件处理函数引用 (destroy 时需移除)
  var mouseMoveHandler = null;
  var clickHandler = null;
  var mouseLeaveHandler = null;
  var resizeHandler = null;

  // ============ 常量映射 ============

  // 四象元素 → RGB 色值 (与 variables.css 中 --element-* 变量一致)
  var ELEMENT_COLORS = {
    '火': { r: 255, g: 107, b: 53 },
    '土': { r: 139, g: 195, b: 74 },
    '风': { r: 129, g: 212, b: 250 },
    '水': { r: 77, g: 208, b: 225 }
  };

  // 渲染常量
  var NUM_STARS = 200;           // 背景星星数量
  var SECTOR_ANGLE = Math.PI / 6; // 每个扇区角度 (30°)
  var START_ANGLE = -Math.PI / 2; // 起始角度 (从顶部 12 点方向开始)
  var WHEEL_RATIO = 0.35;         // 星盘半径占短边的比例
  var MIN_RADIUS = 60;            // 星盘最小半径 (极小屏幕兜底)
  var TOOLTIP_OFFSET = 15;        // 工具提示偏移量 (px)

  // ============ 画布初始化与尺寸计算 ============

  /**
   * 设置画布尺寸, 适配 Retina 高分辨率屏幕
   * 1. 读取容器 clientWidth/clientHeight 作为逻辑尺寸
   * 2. 乘以 devicePixelRatio 设置画布物理像素缓冲
   * 3. 缩放渲染上下文, 使所有绘制坐标使用逻辑像素
   */
  function setupCanvas() {
    if (!canvas || !container) return;

    dpr = window.devicePixelRatio || 1;

    // 从容器获取逻辑尺寸
    logicalWidth = container.clientWidth;
    logicalHeight = container.clientHeight;

    // 边界情况: 容器尺寸过小时使用兜底值, 避免渲染异常
    if (logicalWidth < 10) logicalWidth = 300;
    if (logicalHeight < 10) logicalHeight = 300;

    // 设置画布物理像素缓冲 (高分辨率渲染)
    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);

    // 设置画布 CSS 显示尺寸 (逻辑像素)
    canvas.style.width = logicalWidth + 'px';
    canvas.style.height = logicalHeight + 'px';

    // 重置变换矩阵后按 dpr 缩放, 确保多次调用不会累积缩放
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  // ============ 星空背景 ============

  /**
   * 生成 NUM_STARS 颗背景星星
   * 每颗星包含: 坐标、半径、基础透明度、闪烁速度、闪烁相位
   */
  function generateStars() {
    stars = [];
    for (var i = 0; i < NUM_STARS; i++) {
      stars.push({
        x: Math.random() * logicalWidth,
        y: Math.random() * logicalHeight,
        radius: 0.5 + Math.random() * 1.5,        // 0.5 - 2px
        baseAlpha: 0.3 + Math.random() * 0.5,      // 0.3 - 0.8
        twinkleSpeed: 0.01 + Math.random() * 0.02, // 0.01 - 0.03
        twinklePhase: Math.random() * Math.PI * 2  // 0 - 2π
      });
    }
  }

  /**
   * 绘制背景星空 (带闪烁动画)
   * alpha = baseAlpha + sin(twinklePhase) * 0.3, 限制在 [0, 1]
   */
  function drawStars() {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      // 推进闪烁相位
      s.twinklePhase += s.twinkleSpeed;

      // 计算当前透明度 (正弦波调制, 振幅 0.3)
      var alpha = s.baseAlpha + Math.sin(s.twinklePhase) * 0.3;
      if (alpha < 0) alpha = 0;
      if (alpha > 1) alpha = 1;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
      ctx.fill();
    }
  }

  // ============ 黄道十二宫星盘绘制 ============

  /**
   * 绘制完整的黄道十二宫星盘
   * 12 个扇区按黄道顺序排列, 从顶部开始顺时针方向
   */
  function drawZodiacWheel() {
    if (!signs || signs.length === 0) return;

    var centerX = logicalWidth / 2;
    var centerY = logicalHeight / 2;

    // 星盘半径: 取短边的 35%, 保证不超出画布
    var radius = Math.min(logicalWidth, logicalHeight) * WHEEL_RATIO;
    if (radius < MIN_RADIUS) radius = MIN_RADIUS;

    // 根据半径动态调整字号, 适配不同屏幕尺寸
    var symbolFontSize = Math.max(16, Math.min(32, radius * 0.16));
    var nameFontSize = Math.max(10, Math.min(14, radius * 0.08));
    var labelRadius = radius * 0.7; // 符号/文字距圆心的距离

    // ---- 逐个绘制 12 个扇区 ----
    for (var i = 0; i < 12; i++) {
      var sign = signs[i];
      var sectorStart = START_ANGLE + i * SECTOR_ANGLE;
      var sectorEnd = sectorStart + SECTOR_ANGLE;
      var isHovered = (i === hoveredSector);

      // 获取元素颜色 (兜底为蓝色)
      var color = ELEMENT_COLORS[sign.element] || { r: 100, g: 120, b: 200 };
      var opacity = isHovered ? 0.35 : 0.15;

      // 绘制填充扇区 (从圆心到弧线的扇形)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, sectorStart, sectorEnd);
      ctx.closePath();
      ctx.fillStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + opacity + ')';
      ctx.fill();

      // 绘制扇区分界线 (从圆心到外环)
      ctx.strokeStyle = 'rgba(100, 120, 200, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(sectorStart) * radius,
        centerY + Math.sin(sectorStart) * radius
      );
      ctx.stroke();

      // 悬停时绘制金色高亮边框
      if (isHovered) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, sectorStart, sectorEnd);
        ctx.closePath();
        ctx.stroke();
      }

      // 计算扇区中心位置 (弧线中点方向)
      var midAngle = sectorStart + SECTOR_ANGLE / 2;
      var labelX = centerX + Math.cos(midAngle) * labelRadius;
      var labelY = centerY + Math.sin(midAngle) * labelRadius;

      // 绘制星座 Unicode 符号 (大号金色字体, 居中)
      ctx.font = symbolFontSize + 'px Georgia, "PingFang SC", serif';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.symbol, labelX, labelY);

      // 绘制中文名称 (小号字体, 位于符号下方)
      ctx.font = nameFontSize + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(136, 136, 187, 0.85)'; // --text-secondary
      ctx.fillText(sign.name_cn, labelX, labelY + symbolFontSize * 0.8);
    }

    // ---- 绘制最后一条分界线 (闭合圆环) ----
    var closingAngle = START_ANGLE + 12 * SECTOR_ANGLE; // = START_ANGLE + 2π
    ctx.strokeStyle = 'rgba(100, 120, 200, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(closingAngle) * radius,
      centerY + Math.sin(closingAngle) * radius
    );
    ctx.stroke();

    // ---- 绘制外环 (金色描边) ----
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // ---- 绘制内环 (装饰性, 较细较淡) ----
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ============ 碰撞检测 ============

  /**
   * 根据鼠标坐标计算悬停的扇区索引
   * @param {number} x - 鼠标 X (逻辑像素, 相对画布)
   * @param {number} y - 鼠标 Y (逻辑像素, 相对画布)
   * @returns {number} 扇区索引 0-11, 或 -1 表示不在星盘范围内
   */
  function getSectorAtPosition(x, y) {
    var centerX = logicalWidth / 2;
    var centerY = logicalHeight / 2;
    var radius = Math.min(logicalWidth, logicalHeight) * WHEEL_RATIO;
    if (radius < MIN_RADIUS) radius = MIN_RADIUS;

    var dx = x - centerX;
    var dy = y - centerY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // 超出星盘半径 → 不在任何扇区内
    if (distance > radius) return -1;

    // 计算鼠标相对圆心的角度 (atan2 返回 [-π, π])
    var angle = Math.atan2(dy, dx);

    // 将角度归一化: 从顶部 (-π/2) 开始, 顺时针为正
    var normalizedAngle = angle + Math.PI / 2; // 顶部 → 0
    if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

    // 计算扇区索引: sectorIndex = floor(angle / sectorAngle) % 12
    var sectorIndex = Math.floor(normalizedAngle / SECTOR_ANGLE) % 12;
    return sectorIndex;
  }

  // ============ 工具提示 ============

  /**
   * 更新工具提示内容和位置
   * @param {number} sectorIndex - 扇区索引, -1 时隐藏提示
   * @param {number} x - 鼠标 X (逻辑像素, 相对容器)
   * @param {number} y - 鼠标 Y (逻辑像素, 相对容器)
   */
  function updateTooltip(sectorIndex, x, y) {
    if (!tooltip) return;

    if (sectorIndex >= 0 && signs && signs[sectorIndex]) {
      var sign = signs[sectorIndex];
      tooltip.innerHTML =
        '<span class="tooltip-symbol">' + sign.symbol + '</span>' +
        '<span class="tooltip-name">' + sign.name_cn + ' · ' + sign.name_en + '</span>' +
        '<span class="tooltip-date">' + sign.date_range + '</span>';

      // 定位到鼠标坐标 (CSS transform 会将提示框上移居中)
      tooltip.style.left = (x + TOOLTIP_OFFSET) + 'px';
      tooltip.style.top = (y + TOOLTIP_OFFSET) + 'px';
      tooltip.classList.add('visible');
    } else {
      hideTooltip();
    }
  }

  /**
   * 隐藏工具提示
   */
  function hideTooltip() {
    if (tooltip) {
      tooltip.classList.remove('visible');
    }
  }

  // ============ 动画循环 ============

  /**
   * 主动画循环 (每帧执行)
   * 1. 清空画布 (透明, 让容器 CSS 渐变背景透出)
   * 2. 绘制闪烁星空
   * 3. 绘制黄道十二宫星盘 (含悬停高亮)
   * 通过 requestAnimationFrame 持续循环, 直至 destroy() 取消
   */
  function animate() {
    if (!ctx) return;

    // 清空画布 (透明清除, 保留容器 CSS 渐变背景)
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // 绘制闪烁星空背景
    drawStars();

    // 绘制黄道十二宫星盘 (含当前悬停状态)
    drawZodiacWheel();

    // 继续下一帧
    animationId = requestAnimationFrame(animate);
  }

  // ============ 事件处理 ============

  /**
   * 绑定画布交互事件 (mousemove / click / mouseleave) 和窗口 resize
   * 所有处理函数引用存储在模块变量中, 供 destroy() 精确移除
   */
  function bindEvents() {

    // ---- 鼠标移动: 悬停检测 + 工具提示 ----
    mouseMoveHandler = function (e) {
      if (!canvas) return;

      // 计算鼠标相对画布的逻辑坐标 (CSS 像素)
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      mouseX = x;
      mouseY = y;

      // 碰撞检测: 判断鼠标位于哪个扇区
      hoveredSector = getSectorAtPosition(x, y);

      // 更新工具提示
      updateTooltip(hoveredSector, x, y);

      // 悬停扇区时显示手型光标
      canvas.style.cursor = hoveredSector >= 0 ? 'pointer' : 'default';
    };

    // ---- 点击: 导航到星座详情页 ----
    clickHandler = function () {
      if (hoveredSector < 0) return;
      if (!signs || !signs[hoveredSector]) return;

      var sign = signs[hoveredSector];
      if (window.Router) {
        window.Router.navigate('#/sign/' + sign.id);
      }
    };

    // ---- 鼠标离开画布: 清除悬停状态 ----
    mouseLeaveHandler = function () {
      hoveredSector = -1;
      hideTooltip();
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    };

    // ---- 窗口尺寸变化: 重新计算画布 (防抖 150ms) ----
    resizeHandler = function () {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(function () {
        resizeTimer = null;
        if (!canvas || !ctx) return;
        setupCanvas();
        generateStars(); // 重新生成星星以适配新尺寸
      }, 150);
    };

    // 注册事件监听
    canvas.addEventListener('mousemove', mouseMoveHandler);
    canvas.addEventListener('click', clickHandler);
    canvas.addEventListener('mouseleave', mouseLeaveHandler);
    window.addEventListener('resize', resizeHandler);
  }

  // ============ 公共 API ============

  /**
   * 渲染星图视图容器 HTML 到 #app-view, 然后初始化画布
   */
  function render() {
    var appView = document.getElementById('app-view');
    if (!appView) return;

    appView.innerHTML =
      '<div class="view-starmap">' +
        '<div class="starmap-header">' +
          '<h1 class="view-title">星图</h1>' +
          '<p class="view-subtitle">黄道十二宫星盘 · 点击星座查看详情</p>' +
        '</div>' +
        '<div class="starmap-container" id="starmap-container">' +
          '<canvas id="star-map-canvas"></canvas>' +
          '<div class="starmap-tooltip" id="starmap-tooltip"></div>' +
          '<div class="starmap-legend">' +
            '<span class="legend-item"><span class="legend-dot" style="background:var(--element-fire)"></span>火象</span>' +
            '<span class="legend-item"><span class="legend-dot" style="background:var(--element-earth)"></span>土象</span>' +
            '<span class="legend-item"><span class="legend-dot" style="background:var(--element-air)"></span>风象</span>' +
            '<span class="legend-item"><span class="legend-dot" style="background:var(--element-water)"></span>水象</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    // 渲染 HTML 后初始化画布
    init('star-map-canvas');
  }

  /**
   * 初始化画布: 设置尺寸、生成星空、绑定事件、启动动画
   * @param {string} canvasId - Canvas 元素的 DOM ID
   */
  function init(canvasId) {
    // 安全清理上一次的状态 (SPA 视图切换时防止重复初始化)
    destroy();

    canvas = document.getElementById(canvasId);
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 获取容器 (画布父元素) 和工具提示元素
    container = canvas.parentElement;
    tooltip = document.getElementById('starmap-tooltip');

    // 缓存星座数据 (避免每帧调用 getAll)
    if (window.ZodiacData && typeof window.ZodiacData.getAll === 'function') {
      signs = window.ZodiacData.getAll();
    }
    if (!signs || signs.length === 0) {
      signs = [];
    }

    // 设置画布尺寸并生成星空
    setupCanvas();
    generateStars();

    // 绑定交互事件
    bindEvents();

    // 启动动画循环
    animate();
  }

  /**
   * 销毁模块: 取消动画帧、移除所有事件监听、清理引用
   * 在 SPA 导航离开星图视图时调用
   */
  function destroy() {
    // 1. 取消动画帧
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    // 2. 清除 resize 防抖计时器
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }

    // 3. 移除画布事件监听 (mousemove / click / mouseleave)
    if (canvas) {
      if (mouseMoveHandler) {
        canvas.removeEventListener('mousemove', mouseMoveHandler);
      }
      if (clickHandler) {
        canvas.removeEventListener('click', clickHandler);
      }
      if (mouseLeaveHandler) {
        canvas.removeEventListener('mouseleave', mouseLeaveHandler);
      }
    }

    // 4. 移除窗口 resize 监听
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }

    // 5. 隐藏工具提示
    hideTooltip();

    // 6. 清理所有引用 (释放内存, 防止闭包泄漏)
    canvas = null;
    ctx = null;
    container = null;
    tooltip = null;
    stars = [];
    signs = null;
    hoveredSector = -1;
    mouseX = 0;
    mouseY = 0;
    logicalWidth = 0;
    logicalHeight = 0;
    dpr = 1;

    mouseMoveHandler = null;
    clickHandler = null;
    mouseLeaveHandler = null;
    resizeHandler = null;
  }

  // ============ 导出公共 API ============
  return {
    render: render,
    init: init,
    destroy: destroy
  };
})();
