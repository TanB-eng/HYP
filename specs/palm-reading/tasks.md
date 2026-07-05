# Tasks: Palm Reading（看手相）

**Input**: `specs/palm-reading/spec.md`、`specs/palm-reading/plan.md`  
**Scope**: 在现有单页 HTML 应用中新增手相功能入口，延续现有星空主题，并提供本地照片上传；后续按优先级补充离线互动、AI 解读和知识百科。

## Implementation Strategy

先完成可独立交付的 MVP：导航入口、`#/palm` 路由、同风格手相页面、点击/拖拽上传、照片校验与 Canvas 展示。随后依次增加离线掌纹互动、Gemini 深度解读和手相知识百科。仅修改计划列出的现有前端文件及手相专用文件，不重构其他星座功能。

**MVP scope**: Phase 1 + Phase 2 + User Story 1。

---

## Phase 1: Setup

**Purpose**: 接入现有 HTML、路由和主题样式体系。

- [x] T001 [P] 在 `css/palm.css` 中建立手相页面专用样式，复用 `css/variables.css` 的颜色、间距、圆角和阴影变量，并覆盖上传区、Canvas 区、操作按钮、结果面板与折叠区
- [x] T002 [P] 在 `index.html` 中新增“手相”导航项（`href="#/palm"`、`data-route="/palm"`），保留现有 `css/palm.css` 引用，并按依赖顺序在 `js/app.js` 前加载 `js/palm-data.js` 与 `js/palm.js`
- [x] T003 [P] 在 `js/app.js` 中注册 `#/palm` 路由、调用 `PalmView.render()`、补充导航高亮，并在离开手相页时调用 `PalmView.destroy()`

---

## Phase 2: Foundational

**Purpose**: 建立所有用户故事共用的数据和视图生命周期。

- [x] T004 [P] 校验并同步 `js/palm-data.js` 与 `data/palm-reading.json` 的四条主线字段、归一化叠加坐标和解读变体，保留 `PalmData.getLine()`、`PalmData.getAllLines()`、`PalmData.getRandomInterpretation()` 对外接口
- [x] T005 [P] 在 `js/palm.js` 中建立全局 `PalmView` 模块，定义 `render()`、`destroy()`、图片状态、Canvas 状态、已识别线条状态和事件清理容器
- [x] T006 在 `js/palm.js` 中实现共用 DOM 查询、状态重置、Canvas 尺寸同步与重绘入口，确保后续上传、旋转、缩放和叠加层都通过同一重绘流程更新

**Checkpoint**: `#/palm` 能打开空的手相视图，切换到其他路由后不残留监听器。

---

## Phase 3: User Story 1 — 手掌照片上传与展示（P1）🎯 MVP

**Goal**: 用户能从导航进入手相页面，上传本地手掌照片并在 Canvas 中查看和调整。

**Independent Test**: 打开 `#/palm`，确认页面风格与现有网站一致；分别用点击和拖拽上传合法图片；验证非法格式及超过 10MB 的文件被拒绝；确认图片可旋转、滚轮缩放并可重新上传。

- [x] T007 [US1] 在 `js/palm.js` 的 `PalmView.render()` 中渲染 `.view-palm` 页面结构，包括复用 `.view-title`/`.view-subtitle` 的页头、手掌图标上传区、隐藏文件输入、Canvas 容器、旋转/重新上传控件、隐私提示和娱乐免责声明
- [x] T008 [US1] 在 `js/palm.js` 中实现点击上传与拖拽上传事件，使用 `FileReader` 读取本地文件，并校验 JPG、PNG、WebP MIME 类型及 10MB 大小上限
- [x] T009 [US1] 在 `js/palm.js` 中将合法图片绘制到 Canvas，按容器自动适配并保持宽高比，同时处理 `devicePixelRatio` 以避免高分屏模糊
- [x] T010 [US1] 在 `js/palm.js` 中实现左转/右转 90°和鼠标滚轮缩放，限制合理缩放范围并通过共用重绘流程保持图片居中
- [x] T011 [US1] 在 `js/palm.js` 中实现“重新上传”和上传失败恢复流程，清除旧图片与相关分析状态，恢复上传区并显示可理解的中文错误提示

**Checkpoint**: User Story 1 可独立演示，是本功能的首个可交付版本。

---

## Phase 4: User Story 2 — 趣味互动线条识别（P1）

**Goal**: 用户能在照片上查看四条主线参考、逐条获得离线解读并生成完整报告。

**Independent Test**: 上传照片后依次选择并点击感情线、智慧线、生命线和事业线，确认参考线、序号、标签、解读面板和标记正确；完成四条线后显示汇总报告；“重新分析”可完全重置。

- [x] T012 [US2] 在 `js/palm.js` 中渲染四条主线选择器，并根据 `js/palm-data.js` 的归一化坐标在 Canvas 上绘制半透明参考线、序号和中英文标签
- [x] T013 [US2] 在 `js/palm.js` 中实现 Canvas 指针坐标换算与线条点击判定，为已选择线条绘制对应颜色标记，并从 `PalmData` 获取随机解读
- [x] T014 [US2] 在 `js/palm.js` 中实现解读面板，展示线条中英文名、位置、领域、基本说明、随机特征及含义，并明确标注“娱乐模式·仅供参考”
- [x] T015 [US2] 在 `js/palm.js` 中跟踪四条线的完成状态，全部完成后生成汇总报告，并实现“重新分析”和“清除标记”操作

**Checkpoint**: User Story 2 完全离线工作，不发送照片或解读数据。

---

## Phase 5: User Story 3 — AI 深度解读（P2）

**Goal**: 用户可自行配置 Gemini API Key，将当前手掌照片直接发送给 Gemini 并查看格式化结果。

**Independent Test**: 上传照片、保存有效 Key、发起分析并看到加载状态与格式化结果；刷新后 Key 仍存在；可复制结果、重新分析和清除 Key；无照片、无效 Key、超时、限额和网络错误均有明确提示。

- [x] T016 [US3] 在 `js/palm.js` 中实现 API Key 设置弹窗、密码输入、保存与清除操作，使用 `localStorage` 键 `hyp_palm_apikey`，并根据 Key 与照片状态控制“AI 深度解读”按钮
- [x] T017 [US3] 在 `js/palm.js` 中实现发送前图片压缩，将原始手掌图等比缩放至最长边 1024px、转为 JPEG 0.85 Base64，并剥离 Data URL 前缀
- [x] T018 [US3] 在 `js/palm.js` 中按 `specs/palm-reading/plan.md` 构建 Gemini `generateContent` 请求，包含中文手相提示词和 `inlineData`，设置 30 秒超时并解析文本响应
- [x] T019 [US3] 在 `js/palm.js` 中实现 AI 加载状态、结果面板、安全的轻量 Markdown 渲染、复制结果和重新分析操作，并显示 Google Gemini 来源与娱乐免责声明
- [x] T020 [US3] 在 `js/palm.js` 中分别处理无照片、401/403、429、超时、网络失败和空响应，为每类失败显示对应中文提示且恢复按钮状态

**Checkpoint**: AI 功能是可选增强；没有 API Key 时不影响 US1 和 US2。

---

## Phase 6: User Story 4 — 手相知识百科（P3）

**Goal**: 用户无需上传照片也能浏览四条主线的基础知识和常见变体。

**Independent Test**: 直接进入 `#/palm`，展开“手相知识”，切换四条主线并确认位置图、基本含义及全部变体内容来自内置数据。

- [x] T021 [US4] 在 `js/palm.js` 中实现“手相知识”折叠区与四条主线标签页，从 `PalmData` 渲染位置、领域、基本说明和全部解读变体
- [x] T022 [US4] 在 `js/palm.js` 中使用现有叠加坐标绘制每条主线的简化手掌位置图，并在切换标签时同步更新图示和文字

**Checkpoint**: User Story 4 不依赖照片上传、AI Key 或网络。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 完成响应式、可访问性、性能与完整验收。

- [x] T023 [P] 在 `css/palm.css` 中补齐桌面、平板和移动端布局，确保导航增加第五项后仍可用，Canvas 不横向溢出，按钮可换行，面板在窄屏纵向排列
- [x] T024 [P] 在 `js/palm.js` 中补齐上传区键盘操作、焦点样式所需状态、按钮禁用状态、Canvas/控件可访问名称和拖拽反馈
- [x] T025 在 `js/palm.js` 中完成 `PalmView.destroy()`，移除上传、拖拽、滚轮、Canvas、窗口变化等监听器，终止未完成的 AI 请求并释放图片引用
- [x] T026 按 `specs/palm-reading/spec.md` 逐项验证导航、同风格页面、上传限制、Canvas 操作、离线解读、AI 错误路径、知识百科、隐私文案和移动端布局，并修复仅与本功能直接相关的问题

---

## Dependencies

```text
Phase 1 Setup
  T001 ─┐
  T002 ─┼──> Phase 2 Foundational: T005 -> T006
  T003 ─┘                              │
  T004 ────────────────────────────────┼──> US2
                                      ├──> US4
                                      └──> US1: T007 -> T008 -> T009 -> T010 -> T011
                                                               │
                                                               ├──> US2: T012 -> T013 -> T014 -> T015
                                                               └──> US3: T016 -> T017 -> T018 -> T019 -> T020

US4: T004 + T005 -> T021 -> T022

Polish: US1-US4 -> T023 / T024 -> T025 -> T026
```

### User Story Completion Order

- **US1 (P1)**: 首先完成；它直接交付入口、同风格页面和照片上传接口。
- **US2 (P1)**: 依赖 US1 的 Canvas 图片展示和 T004 的内置数据。
- **US3 (P2)**: 依赖 US1 的图片状态；不依赖 US2，可在 US1 完成后与 US2 并行。
- **US4 (P3)**: 只依赖基础视图与 T004，可与 US1-US3 并行开发。

## Parallel Execution Examples

### Setup / Foundational

- T001：实现 `css/palm.css`
- T002：更新 `index.html`
- T003：更新 `js/app.js`
- T004：校验 `js/palm-data.js` 与 `data/palm-reading.json`
- T005：建立 `js/palm.js` 模块骨架

### After US1

- 顺序流 A：T012 -> T013 -> T014 -> T015（离线互动）
- 顺序流 B：T016 -> T017 -> T018 -> T019 -> T020（AI 解读）
- 顺序流 C：T021 -> T022（知识百科）

### Polish

- T023：`css/palm.css` 响应式布局
- T024：`js/palm.js` 可访问性与交互状态

## Delivery Strategy

1. **MVP**: 完成 T001-T011，只交付用户明确提出的手相入口、同风格页面和照片上传/展示。
2. **Offline increment**: 完成 T012-T015，交付无需网络的趣味掌纹解读。
3. **AI increment**: 完成 T016-T020，交付可选 Gemini 深度解读。
4. **Knowledge increment**: 完成 T021-T022，交付手相百科。
5. **Release hardening**: 完成 T023-T026 后进行完整验收。
