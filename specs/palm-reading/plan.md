# Implementation Plan: Palm Reading (看手相)

## Tech Stack (增量)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| 图片展示 | Canvas 2D API (复用) | 在 Canvas 上绘制照片和标记点，支持交互 |
| 文件上传 | HTML5 File API (FileReader) | 纯前端读取本地图片，无需服务器 |
| AI 调用 | Google Gemini 2.5 Flash REST API | 稳定多模态模型，支持图片输入和文本输出 |
| 图片压缩 | Canvas toBlob/toDataURL | 发送 API 前压缩图片到合理尺寸 |
| Markdown 渲染 | 轻量正则替换 | 渲染 AI 返回的 Markdown 文本 |

## Google Gemini API 集成

### 接口信息

- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=API_KEY`
- **Method**: POST
- **Content-Type**: application/json
- **请求体**: 包含 inlineData (Base64 图片) + text prompt
- **响应**: candidates[0].content.parts[0].text (Markdown 文本)
- **CORS**: Google 已开启，浏览器可直接 fetch 调用

### Prompt 设计

```
你是一位经验丰富的手相学大师。请分析这张手掌照片，从手相学角度解读以下四大主线：
1. 感情线（Heart Line）- 反映情感和人际关系
2. 智慧线（Head Line）- 反映思维和决策方式
3. 生命线（Life Line）- 反映生命力和健康
4. 事业线（Fate Line）- 反映事业和命运

请用中文回复，格式如下：
## 感情线分析
[分析内容]
## 智慧线分析
[分析内容]
## 生命线分析
[分析内容]
## 事业线分析
[分析内容]
## 综合建议
[综合建议]

注意：请在末尾注明"以上分析仅供娱乐参考"。
```

## Project Structure (增量)

```
D:\Github项目\HYP星座研究链接\
├── index.html                  # 新增 <script src="js/palm.js"> 和导航"手相"链接
├── css/
│   └── palm.css                # 手相页面专用样式
├── js/
│   ├── palm-data.js            # 手相学内置数据库 (四大线条解读)
│   ├── palm.js                 # 手相功能模块 (上传、互动、AI调用)
│   └── app.js                  # 新增路由 #/palm → PalmView.render()
└── data/
    └── palm-reading.json       # 手相数据 JSON (用户可编辑参考)
```

## Architecture

### 视图集成

在现有 SPA 路由中新增：
- `#/palm` → PalmView.render() — 手相主页面

导航栏新增第五个导航项"手相"，图标为 ✋。

### Canvas 交互流程

1. 用户上传照片 → FileReader 读取 → 创建 Image 对象 → 绘制到 Canvas
2. 选择线条类型 → Canvas 上叠加半透明参考线
3. 用户点击 Canvas → 记录坐标 → 绘制彩色标记点 → 弹出解读面板
4. 四种线条用四种颜色标记，可同时存在多个标记

### AI 调用流程

1. 用户点击"AI 深度解读" → 弹出 API Key 输入
2. 保存 Key 到 localStorage (可选)
3. Canvas 图片转 Base64 (压缩到长边 1024px)
4. 构建 Gemini API 请求体
5. fetch POST → 显示加载动画
6. 解析响应 → 渲染 Markdown 到页面
7. 错误处理：网络错误、Key 无效、额度用尽

### 图片压缩

```javascript
// Canvas 绘制时缩放到合适尺寸
function compressImage(img, maxDim = 1024) {
  const canvas = document.createElement('canvas');
  let { width, height } = img;
  if (width > height && width > maxDim) {
    height = (height * maxDim) / width;
    width = maxDim;
  } else if (height > maxDim) {
    width = (width * maxDim) / height;
    height = maxDim;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
```

## Design Decisions

1. **Canvas vs SVG for image annotation**: Canvas chosen because we already use it for the star map, and it's better for image display + overlay + click detection in one layer.

2. **API Key storage**: Stored in localStorage with user consent. Never sent anywhere except directly to Google's API endpoint. Clear button provided.

3. **Image not persisted**: Uploaded photos are only in memory (Canvas). No localStorage storage of image data (too large). Refreshing the page clears everything.

4. **Markdown rendering**: Lightweight regex-based renderer (no library). Only needs to handle ##, **, -, and paragraphs.

5. **Privacy**: Clear disclosure that photos go directly to Google's API, no intermediate server.

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Gemini API CORS blocked | Google已开启CORS;如失败提供错误提示和手动方案 |
| API Key 泄露风险 | Key仅存localStorage,提供清除按钮,不上传到任何第三方 |
| 图片太大导致API失败 | 压缩到长边1024px,JPEG 0.85质量 |
| 用户没有Gemini API Key | 趣味互动模式不依赖API,始终可用 |
| 浏览器不支持File API | 现代浏览器都支持;显示兼容性提示 |
