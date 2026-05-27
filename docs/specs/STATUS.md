# TTAI 项目状态报告 & 开发路线图

> 更新时间: 2026-05-22 收工 | 后端 35/35 ✅ | 前端 Jest 142/142 ✅ | 后端: Ubuntu 192.168.1.238

---

## 今日动态 (各 session 开工/收工时更新)

| 时间 | 工程师 | 模块 | 动作 | 影响范围 |
|------|--------|------|------|---------|
| | | | | |

**规则**: 开工写「开始: xxx」，共享模块标 ⚠️；收工写「完成: xxx」+ 更新测试状态。

---

## 一、项目概览

乒乓球AI训练平台，微信小程序 + Docker 微服务后端。核心能力：视频AI分析、赛事信息聚合、AI教练对话。

**目标用户**: 专业青少年选手 (8-18岁) + 狂热乒乓球爱好者 (20-45岁) + 基层教练

---

## 二、模块完成度矩阵

| 模块 | 状态 | 完成度 | 最后更新 | 工程师 |
|------|------|--------|---------|--------|
| **首页 Dashboard** | ✅ 已上线 | 70% | 2026-05-17 | - |
| **视频分析·比赛回合剪辑** | ✅ 已上线 | 92% | 2026-05-19 | Jack |
| **视频分析·训练视频分析** | ✅ 已上线 | 88% | 2026-05-19 | Jack |
| **发现·赛事日历** | ✅ 已上线 | 95% | 2026-05-21 | Alice |
| **发现·青少年赛事** | ✅ 已上线 | 98% | 2026-05-23 | Alice |
| **发现·赛事详情页** | ✅ 新增 | 90% | 2026-05-21 | Alice |
| **发现·赛事助手** | ✅ 新增 | 80% | 2026-05-21 | Alice |
| **发现·技术挑战** | 🔲 占位 | 20% | 2026-05-17 | - |
| **发现·视频广场** | 🔲 占位 | 10% | 2026-05-17 | - |
| **发现·技战术分析** | ✅ 已上线 | 95% | 2026-05-20 | Alice |
| **发现·乒乓文档** | ✅ 已上线 | 85% | 2026-05-22 | Alice |
| **AI教练对话 (tech)** | ✅ 已重构 | 95% | 2026-05-21 | Jim |
| **AI对话·Markdown渲染** | ✅ 新增 | 90% | 2026-05-17 | Jim |
| **我的·个人资料** | ✅ 已上线 | 92% | 2026-05-19 | Howie |
| **我的·视频库** | ✅ 已上线 | 95% | 2026-05-21 | Howie |
| **我的·对手档案** | ✅ 已上线 | 88% | 2026-05-21 | Howie |
| **我的·训练统计** | ✅ 已上线 | 80% | 2026-05-21 | Howie |
| **我的·赛事** | ✅ 已上线 | 60% | 2026-05-21 | Howie |
| **我的·AI认证** | ✅ 已上线 | 80% | 2026-05-21 | Howie |
| **联系我们** | ✅ 可用 | 100% | 2026-05-17 | - |
| **微信登录** | ✅ 可用 | 80% | 2026-05-17 | - |
| **后端 FastAPI** | ✅ 已上线 | 90% | 2026-05-17 | - |
| **后端 Express** | ✅ 已重构 | 92% | 2026-05-20 | Jim + Alice + Jack |
| **后端爬虫** | ✅ 已激活 | 95% | 2026-05-20 | Alice + Jack |
| **前端单元测试** | ✅ 新增 | 85% | 2026-05-17 | Jim |
| **前端集成测试** | ✅ 新增 | 85% | 2026-05-17 | Jim |
| **基础设施 (回归测试等)** | ✅ | - | 2026-05-18 | Jim + Jack |

---

## 三、后端服务状态

| 服务 | 端口 | 状态 | 说明 |
|------|------|------|------|
| FastAPI | :5000 | ✅ | 视频上传/处理/下载/状态/precheck/confirm-target/report 8个端点 |
| Express | :3000 | ✅ | 微信登录/用户资料/反馈/WebSocket AI + **赛事API (5个端点) + 爬虫调度** |
| Nginx | :80/:443 | ✅ | 反向代理 + Web前端静态文件 |
| Celery GPU | - | ✅ | YOLOv8-pose ONNX 推理 |
| Celery Video | - | ✅ | FFmpeg 视频处理 |
| MongoDB | :27017 | ✅ | 用户/反馈 + **events 集合 (54条种子数据)** |
| Redis | :6379 | ✅ | 上传状态/Celery broker/session |
| Flower | :5555 | ✅ | Celery 任务监控 |

### Express 赛事 API 端点 (新增)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/events` | 赛事列表: month/city/type/status 筛选 + 分页 |
| `GET` | `/api/events/:id` | 赛事详情 (跳转详情页用) |
| `GET` | `/api/events/refresh` | 手动触发爬虫 |
| `GET` | `/api/competitions/search` | 青少年赛事搜索 (keyword/city/source) |
| `POST` | `/api/competitions/recommend` | AI 智能推荐 |
| `GET` | `/api/competitions/platforms` | 赛事平台入口 |
| `GET` | `/api/competitions/eightcups` | 八大杯赛信息 |
| `GET` | `/api/tactics` | 技战术分析列表 (contentType/timeRange/tag/year) |
| `GET` | `/api/tactics/:id` | 技战术分析详情 (sections/references/videoId) |
| **Express 文档 API** | | |
| `GET` | `/api/docs/list` | 文档列表 (cat/page) |
| `GET` | `/api/docs/:id` | 文档详情 (含 AI 加工内容) |
| `POST` | `/api/docs/:id/like` | 文档点赞 |
| `GET` | `/api/docs/refresh` | 手动触发文档爬虫 |

---

## 今日进展 (2026-05-22 Alice)

### 赛事日历·收紧过滤
- 赛事日历仅展示顶级大赛: 三大赛 / WTT / 乒超 / 洲际赛 / 全运会 / 全国锦标赛
- 排除: 青年/少年/少儿/大学生、俱乐部联赛/会员联赛、行政通知/名单/观赛报道

### 青少年赛事·平台检测 + 赛事助手
- `crawlSogouYouthEvents()`: 识别爱聚网/开球网/全乒乓/乒赛通/中国乒协会员
- `event` 模型新增 `platform` 字段, 详情页新增「📱 赛事助手」卡片

### 乒乓文档·数据清理
- 删除 16 篇 CTTA 空壳 (excerpt 为 HTML 碎片), Puppeteer 补充 10 篇 (9 篇 AI 加工)

### Puppeteer 合规
- 小程序仅展示 API 返回, 无违规 API → 无封杀风险

---

## 今日进展 (2026-05-23 Alice)

### CTTA 全国青少年赛表格导入
- 从 `syzl/zt/2026/0123/686035.html` 解析完整比赛表, 24 场全部入库
- 含 startDate-endDate 区间、比赛地点、城市 (覆盖 1-12 月)

### 青少年赛事 UI 改版
- 卡片右上角状态 badge + 左下角日期区间+地点
- 仅实际比赛显示状态 (location 非空)
- 按日期升序 + 自动滚动到当月第一场
- 仅显示 2026+ 赛事 + 全国赛 filter 扩展

### Events API
- 新增 `sort`/`order` 参数, pageSize 提升至 200

### 修复
- WXSS 多余 `}` 编译错误 + revert 后三文件恢复

---

## 四、近期进展 (2026-05-19 Alice — 乒乓文档模块)

### 乒乓文档模块 Phase 1 完成

| 阶段 | 内容 | 状态 |
|------|------|------|
| 后端模型 | `docs` 集合: title/excerpt/content/category/qualityScore/status/aiProcessed | ✅ |
| 后端 API | 4 端点: list (cat/page), detail, like, refresh | ✅ |
| 抓取脚本 | `refresh-docs.js`: CTTA 5 栏目 (政策法规/协会公告/青少年/全民健身/裁判) + 搜狗微信搜索 | ✅ |
| AI 加工 | DeepSeek API 重组 CTTA 长文为统一模板 (核心要点+详细分析+实践建议) | ✅ |
| 前端列表 | 分类筛选: 官方规程/技术进阶/战术策略/训练青训/器材装备/综合阅读 | ✅ |
| 前端详情 | 双模式: CTTA 全文(AI badge) + 搜狗摘要(搜索提示) | ✅ |
| 数据管理 | 3 种触发方式: curl API / docker exec / shell 脚本 | ✅ |

### Puppeteer 微信全文抓取 (✅ 已解决 2026-05-20)

| 尝试 | 结果 |
|------|------|
| 搜狗搜索结果 HTML 中找隐藏真实 URL | ❌ 无 — 只有 `/link?url=` 混淆链接 |
| 搜狗重定向链 → Sogou 返回 `302 → antispider` | ❌ 反爬保护，服务器端无法通过 |
| Alpine 容器 apk add chromium | ❌ 网络超时 (CDN 慢) |
| 宿主机 apt install chromium-browser | ⚠️ snap 包装器，Docker 内不可用 |
| npx puppeteer browsers install chrome | ❌ 下载超时 (~150MB) |
| **下一步** | ✅ **已解决**: 宿主机装 Chromium + puppeteer-core@21 → `node scripts/fetch-wechat-articles.js --max=N` 可稳定抓取微信文章全文

### 关键技术决策

| 决策 | 原因 |
|------|------|
| 搜狗文章保留摘要模式 | 反爬保护无法服务器端突破，前端诚实标注「摘要」+ 搜索提示 |
| CTTA 扩展至 5 个栏目 | 纯 HTML 同构抓取，零额外成本 |
| AI 加工仅用于 CTTA 长文 (>500字) | 短文不值得消耗 token |
| `refresh-docs.js` 可直接独立运行 | `require.main === module` 检测，同时支持 API 触发 |

### 搜狗反爬分析结论

- Sogou `/link?url=` 搜索结果链接 → 请求后返回 `302 → Location: /antispider/`
- 搜索页面 HTML 中**没有隐藏的真实 mp.weixin.qq.com URL**
- antispider 验证在客户端 JS (`article.min.js`) 中完成
- 只有真浏览器 (Chromium/Puppeteer) 或 WeChat App 内能通过

---

## 六、近期进展 (2026-05-17 Alice)

### 赛事模块 Phase 1+2 完成
| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | MongoDB Event 模型 + 种子数据(54条) + `/api/events` 查询 | ✅ |
| Phase 1 | `competitions.js` 从内存数组迁移到 MongoDB 实时查询 | ✅ |
| Phase 1 | 前端 discover.js 事件日历对接 API, 去除硬编码 | ✅ |
| Phase 2 | 爬虫框架 `crawler.js`: 3源插件(ctta/aijuwang/kaiqiuwang) + 去重 + 入库 | ✅ |
| Phase 2 | 每日凌晨2点定时调度 (`scheduleDaily` in server.js) | ✅ |
| Phase 2 | 前端赛事详情页 `event-detail` (4文件) + 关注提醒 | ✅ |
| Phase 2 | 青少年赛事卡片跳转详情 | ✅ |
| 契约 | `api-contract.md` 新增 5 个赛事端点文档 | ✅ |

### 关键技术决策
| 决策 | 原因 |
|------|------|
| 爬虫用 Node.js (非 Celery beat) | Express 容器已有 mongoose 连接，无需新增 Python 依赖/重建镜像；`scheduleDaily()` 比 Celery beat 更轻量 |
| 爬虫函数为 stub，框架已就绪 | ctta.cn 等目标站需 JS 渲染/反爬，实际抓取需 headless browser 或 API 对接。框架的插件架构 + 去重 + 入库已完备，后续只改 `crawl*()` 函数即可 |
| 赛事日历 + 青少年赛事共用 MongoDB `events` 集合 | 统一数据源，通过 `type` 字段区分 (international/domestic/youth)，避免维护两套数据 |
| 详情页单独路由 `pages/discover/event-detail/` | 支持分享卡片直达，URL参数可携带 event ID |

### 遇到的问题
| 问题 | 解决 |
|------|------|
| PowerShell 通过 SSH 写入中文文件时引号被剥离 | 改为本地写文件 → `scp` 上传 |
| `/api/events/refresh` 被 `/:id` 路由捕获 (Express 路由顺序) | 将 `/refresh` 路由移到 `/:id` 之前注册 |
| 前端 discover.js 的 `allEvents` 与后端 MongoDB 数据字段不匹配 | 后端 `items.map()` 统一输出 shape，前端 WXML 无需改动 |
| `wx.requestSubscribeMessage` 需要后台配置模板ID | 前端做了降级: 模板消息失败时自动切换到 localStorage 本地存储提醒 |

---

## 五、近期进展 (2026-05-17 Jim)

### AI教练对话模块 Phase 1 完成
| 阶段 | 内容 | 状态 |
|------|------|------|
| Markdown解析 | `utils/markdown.js`: 粗体/斜体/代码/标题/列表/链接/引用 | ✅ |
| AI对话页重构 | `pages/tech/` JS拆分 + WXML/WXSS优化 + 流式输出 | ✅ |
| HTTP回退API | Express `POST /ask` (OpenAI兼容格式) | ✅ |
| 对话反馈 | `POST /api/chat/feedback` (评分+文字反馈) | ✅ |
| 训练日志 | `POST/GET/PUT/DELETE /api/chat/sessions/:id/logs` | ✅ |
| 会话管理 | `GET /api/chat/sessions` (列表/创建/删除) | ✅ |
| 回归测试 | 新增6条: ask端点/空消息拒绝/反馈保存/非法评分/会话列表/日志CRUD | ✅ |
| 单元测试 | `utils/markdown.test.js` 16条用例 | ✅ |
| 设计文档 | `docs/specs/SPEC-ai-talk.md` | ✅ |

### AI教练对话模块 Phase 2-5 更新 (2026-05-18/21 | Jim)
| 阶段 | 内容 | 状态 |
|------|------|------|
| 模型切换 | deepseek 欠费切换至本地 70B 后切回 deepseek | ✅ |
| 训练日志 | 内联表单/全屏覆盖双模式 + 直接保存原文 | ✅ |
| 设置项 | profile 页新增「日志编辑模式」切换 | ✅ |
| 标签体验 | 选中高亮(深绿底白字+✓)、最多4个限制、自定义标签去重 | ✅ |
| 标签修复 | WXML `.indexOf()` 不工作 → 改用 JS 预计算 `tagSelections` 对象 | ✅ |
| 用户画像 | 数据库原始值人性化映射（a1700→爱聚网1700, twoBackhands→双反） | ✅ |
| 回答质量 | system prompt 精简为口语化教练风格，500字以内 | ✅ |
| 训练上下文 | 发消息时自动注入最近 5 条训练日报摘要 | ✅ |
| 本周概览 | 训练日志列表顶部固定展示本周训练天数/时长/覆盖标签 | ✅ |
| 周报卡片 | 保存后绿色左边框 + 📊周报前缀区分 | ✅ |
| UI 优化 | 去掉保存按钮上废话提示；周报生成增加 loading 反馈 | ✅ |
| 重新生成 | AI 回复下方新增 "🔄 重新生成" 按钮 | ✅ |
| 首页联动 | 首页新增"最近训练"卡片，展示最新日志摘要 | ✅ |
| 分享图片 | 训练日志卡片加 "📤 分享" 按钮，canvas 生成分享图 | ✅ |
| 会话搜索 | 历史会话面板加搜索框，实时过滤 | ✅ |
| 技术库pro | 专业级技术库从 11→15 题 | ✅ |
| 标签优化 | 去掉了 4 个限制、新增多球单练/多球/挑打/升降赛/大循环、删除比赛/拉球 | ✅ |
| 对话同步 | 对话历史双向同步到 MongoDB，切换会话自动从服务端加载消息 | ✅ |
| 时长单位 | 根据用户级别自动切换：专业级→小时，其余→分钟，存盘统一分钟 | ✅ |
| Bug 修复 | 用户消息被注释导致 AI 答非所问 — 已修复 | ✅ |
| Bug 修复 | 时长输入默认值无法删除 — 改为空输入 + digit 键盘 | ✅ |
| Bug 修复 | 技术库用户画像显示英文 — 映射为中文 | ✅ |

### 关键技术决策
| 决策 | 原因 |
|------|------|
| Markdown解析用递归下降而非正则 | 支持嵌套格式 (`**粗体*斜体*粗体**`)，比正则更可靠 |
| 反馈/日志接口在Express而非FastAPI | 与WebSocket AI共用session上下文，减少跨服务调用 |
| 会话ID用UUID而非自增 | 支持多端同步，避免ID冲突 |

---

## 六、近期进展 (2026-05-17/19 Howie)

### 我的·资产模块 Phase 1-5 全部完成

| Phase | 模块 | 前端页面 | 后端 | 状态 |
|-------|------|---------|------|------|
| 1 | 视频库 | `pages/video-lib/list`, `detail`, `import` (列表/详情/缓存/本地导入/本地tab) | 5 端点 (videos CRUD) | ✅ |
| 2 | 对手档案 | `pages/opponent/list`, `add`, `detail` (录入/统计/对战+局分/编辑删除) | 8 端点 (opponents + matches) | ✅ |
| 3 | 训练统计 | `pages/training-stats/index` (趋势图/维度条/频次图/薄弱项) | 1 端点 (stats) | ✅ |
| 4 | 我的赛事 | `pages/my-events/list` (时间线/收藏/发现页联动) | 3 端点 (user_events CRUD) | ✅ |
| 5 | AI等级认证 | `pages/certification/index` (徽章墙/升级建议/训练联动) | 2 端点 (certification) | ✅ |

### 2026-05-19 增强

| 领域 | 内容 | 状态 |
|------|------|------|
| 本地视频导入 | `pages/video-import/index` + `utils/local-video-store.js`；视频库新增 `本地视频` tab | ✅ |
| 本地视频播放 | 详情页 `local_` 前缀直接走本地缓存，不走网络，秒开 | ✅ |
| 个人中心 UI | 顶部压缩为紧凑卡片（头像+昵称+水平/打法标签+编辑），去掉长资料清单 | ✅ |
| 对战局分录入 | 对手详情页支持11分制每局比分录入，自动判定 ✓/✗，自动汇总胜负 | ✅ |
| 对战记录管理 | 每条对战支持 ✏️ 编辑（回填局分）和 🗑️ 删除 | ✅ |
| 未登录静默 | `list.js`/`detail.js` 无 token 时不发 API 请求，不再报 401 | ✅ |
| 首页联动 | 最近分析「全部 →」跳视频库；点击单条直接进视频详情 | ✅ |
| 本地视频缩略图 | 导入本地视频时同步保存视频真封面缩略图，不再用 TTAI logo | ✅ |
| 分享分析卡片 | `pages/video-lib/detail` 训练分析/比赛剪辑 canvas 生成分享图，支持微信分享 | ✅ |
| 局分输入优化 | 0:0 局自动隐藏，仅展示已填局 + 一个空行，支持 deuce 高分 (max 99) | ✅ |
| 上传错误定位 | `uploader.js` 分片失败时列出具体失败分片和错误原因 | ✅ |
| 统计图表升级 | 综合评分趋势 canvas 折线图 + 各维度 canvas 雷达图 | ✅ |
| 参赛自动联动 | 录入对战后自动标记赛事为 participated，减少手动操作 | ✅ |
| AI认证卡片化 | 四维度独立卡片，每张显示等级/分数/距下一级进度条 | ✅ |

### 交付清单

| 资产 | 说明 | 状态 |
|------|------|------|
| 前端页面 | 视频库/对手/统计/赛事/认证/本地导入页面均已覆盖 | ✅ |
| 后端模型 | `video.js`, `opponent.js`, `match.js`(+games strict:false), `user-event.js`, `certification.js` | ✅ |
| 后端路由 | `videos.js`, `opponents.js`(+games format), `stats.js`, `user-events.js`, `certification.js` | ✅ |
| 公共工具 | `utils/video-cache.js` + `utils/local-video-store.js` + `utils/api.js` | ✅ |
| 前端测试 | Jest ui-validation 84/84 通过 (WXML 标签+表达式+嵌套目录扫描) | ✅ |
| 设计文档 | `docs/specs/SPEC-video-lib.md` (Phase 1-5 完整设计 + 开发记录) | ✅ |

---

## 七、近期进展 (2026-05-17/19 Jack)

### 视频分析模块 Phase 1-3 完成
| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 技术债清零: `analysis.js/training.js` 统一采用 `utils/uploader.js`, URL 硬编码清零, `compare.js` 提取 | ✅ |
| Phase 1 | 子Tab任务隔离: `taskStatus.mode` + WXML 按模式过滤 | ✅ |
| Phase 2 | 训练分析主体选择前端状态机 + 选择弹层 + 降级逻辑 | ✅ |
| Phase 2 | 后端 `POST /api/analysis/precheck` + `POST /api/analysis/confirm-target` | ✅ |
| Phase 2 | `targetPersonId/target_bbox` 接入任务上下文 + training tracking 优先锁定选中主体 | ✅ |
| Phase 3 | **评分算法 v2**: 12.6 乒乓球教练标准 16 子维度 + 物理归一化(px→cm) + stroke 分段 | ✅ |
| Phase 3 | **评分报告 UI**: analysis.wxml/wxss 综合分大圆 + 4 维度条 + 薄弱项 + 建议 | ✅ |
| Phase 3 | **数据采集扩展**: ONNX 模式写 pose_data.dat, v2 二进制格式加 shoulder/knee | ✅ |
| bugfix | **5G 压缩上传失败**: 根因服务端 ffmpeg 无法解码 wx.compressVideo 产出编码, 暂时禁用压缩; `onError` 补 `progress:0` 避免 100%+失败同显; `complete` 请求加 retry | ✅ |
| bugfix | **5G 双弹窗卡死**: uploader.js 删除重复 `checkNetwork()`, 网络检查统一归页面层 | ✅ |
| bugfix | **历史任务残留**: `handleUploadComplete` 先清同 mode 旧完成框再写新结果 | ✅ |
| 回归 | 新增主体选择页面级单测 + 后端 2 条 targeting regression | ✅ |
| 回归 | **precheck 激活**: OpenCV HOG CPU 检测替代 ONNX/GPU, API 进程不崩, 4人检出 | ✅ |
| Phase 4 | **会员体系骨架**: User 模型加 membershipTier/remainingAnalyses/analysisResetDate, quota API, profile 页会员卡片, analysis 页 UploadQuota 检查(内测阶段 999 不限) | ✅ |
| 杂项 | quota API 401 静默: `fail: () => {}` 消除控制台红字 | ✅ |

### 2026-05-21 修复 (Jack)
| 问题 | 根因/修复 | 状态 |
|------|----------|------|
| 分片上传重试无效 | 服务端返 `[0,3]` 数字，前端 `includes(String(i))` 永假 | ✅ |
| FastAPI 卡死 | uvicorn 1 worker + precheck HOG/VideoCapture 阻塞 event loop → `--workers 2` + `asyncio.to_thread()` | ✅ |
| 生产 nginx 崩溃 | `/api/analysis` 重复 location + Host header PS 污染 | ✅ |
| precheck 检测不准 | HOG→YOLOv8 ONNX (CPU) 精准框选，HOG 降级 | ✅ |
| 训练分析缩略图缺失 | worker `training_analysis` 加 `cv2.imwrite` 取 overlay 首帧 | ✅ |
| 回合剪辑缩略图缺失 | `update_task_progress` 缺 `thumbnail_path` → 补充入库 | ✅ |
| 缩略图错乱 | setData 全量+单字段冲突 → 一次性重建 `newTaskStatus` + cache-bust | ✅ |
| 选人弹层不可滚动 | 横排改纵排 `scroll-view scroll-y` + footer sticky | ✅ |
| WorkerLostError | worker 子进程崩 → `isinstance(info,dict)` 容错 + restart | ✅ |

### 2026-05-22 修复 (Jack)
| 问题 | 根因/修复 | 状态 |
|------|----------|------|
| 上传可靠性 (4项) | `init` 加 retry + 删重复 `checkNetwork` + MD5 30s 超时 + `request()` 传 timeout | ✅ |
| YOLOv8 检测框不准 | `cv2.resize` 画面变形 → **letterbox** + 正确 `box/scale` 映射 + NMS（match_clip 同款管线） | ✅ |
| 竖屏视频选人弹层看不见 | preview 加 `max-height:380rpx` + panel `overflow-y:auto` | ✅ |
| 评分卡片不显示 | 状态端点返回 `scores` 平铺 dict，前端误读 `result.analysisScore` → 改为 `result.scores` | ✅ |
| 分享卡片丢失 | `git checkout HEAD` 回退了 `onTapShare`/`drawSharePoster` → 恢复 Canvas 2D 海报生成 | ✅ |
| 自动化测试新增 | uploader 加 6 条：init 重试/MD5 超时/分片失败/类型匹配/timeout 参数 | ✅ |

### 关键技术决策
| 决策 | 原因 |
|------|------|
| 主体选择发生在"上传完成后、正式分析前" | 避免上传前多一步阻断；以后端 `task_id` 作为任务上下文主键更稳 |
| `precheck` 先做稳定版 MVP | 先返回预览图和合法 shape，避免 API 进程中跑重检测导致连接中断 |
| 评分从"自归一化"升级为"物理归一化" | bench_roi → 球台 152.5cm 桥接，将像素量转为 cm/s/°，区分为乒乓球专项含义 |
| 评分从"单 clip 聚合"升级为"stroke 分段" | wrist 速度峰值检测单次挥拍，正手/反手各有 4 教练子维度 |
| `precheck` 最终用 HOG CPU 替代 ONNX/GPU | 前期 ONNX 加载在 API 进程反复崩溃 (segfault); HOG 轻量, 4人检测成功, 生产稳定 |
| 会员体系先落骨架再接入支付 | membershipTier + quota API + 前端配额检查, 不依赖支付接入即可上线免费层限流 |
| 5G 压缩禁用保留 stub | wx.compressVideo 产出编码服务端 ffmpeg/OpenCV 解码失败; `compressBeforeUpload` 改为 `Promise.resolve(原文件)`, 待后续调查编码兼容性后恢复 |
| `hugetlb_pool` attach 失败时回退创建共享池 | 避免 Celery worker 因共享内存不可附着直接退出 |

### 已知剩余工作
| 任务 | 状态 |
|------|------|
| 主体选择 UI 产品化 (缩略卡片/当前分析对象标识/更友好降级提示) | 🔲 |
| **Nginx 路由修复**: `/api/analysis/*` 需走 FastAPI (5000), 当前被 `/api/*` 整体转向 Express (3000) | 🔲 |
| 多 rally 分段评分 (正手/反手使用多 clip 样本拉大方差) | 🔲 |

---

### 爬虫激活 + 后端重构
| 阶段 | 内容 | 状态 |
|------|------|------|
| 搜狗微信爬虫 | `crawler.js` 新增搜狗微信搜索引擎爬取，覆盖更多地方赛事 | ✅ |
| 爬虫激活 | `SOURCES` 插件启用 (`sogou` + `ctta` + `aijuwang` + `kaiqiuwang`) | ✅ |
| Server 重构 | `server.js` 路由模块化重写，统一 JWT 中间件 + 路由分离 | ✅ |
| 测试扩展 | 新增赛事 15 条 + 训练日志 4 条 + 清理 1 条，回归从 12 → 31 条 | ✅ |
| Tech 重构 | `tech.js` 拆分 `ai-client.js`，分离 AI 调用逻辑 | ✅ |

### 已知问题 (已修复)
| 问题 | 修复 |
|------|------|
| `server.js` 重构时 `ask.js` 路由未注册 → `/ask` 404 | 2026-05-18 ARCH: 补 `require('./ask')` + `app.use(askRouter)` |
| `ai-client.js` DeepSeek 路径 system message 含重复历史 → 上下文混乱 | 2026-05-18 ARCH: 拆出 `buildSystemPrompt()` 函数，DeepSeek 路径仅传系统指令 |

---

## 八、后续工作 (ARCH 整理)

### 爬虫激活 (Phase 2 收尾)
- [ ] 调研 ctta.cn / aijuwang.net / kaiqiuwang.com 实际页面结构
- [ ] 实现 `crawlCTTA()` / `crawlAijuwang()` / `crawlKaiqiuwang()` 函数
- [ ] 在 `SOURCES.{key}.enabled = true` 启用爬虫
- [ ] 可能需要 `puppeteer` 做 JS 渲染 (package.json 加依赖)

### 赛事模块增强
- [ ] 详情页「关注提醒」对接微信模板消息 (需后台配置模板ID)
- [ ] 首页 Dashboard 集成近期赛事 (`GET /api/dashboard` → upcomingEvent)
- [ ] 赛事报名链接真实化 (目前大部分 url/registrationUrl 为空)

### 其他 P0 任务 (待办)
- [x] AI 评分报告 (训练分析后量化评分) — 评分算法 v2 + 评分报告 UI ✅
- [ ] 分享卡片 (canvas 生成可分享图片)

---

## 十一、已有基础设施

| 资产 | 位置 | 说明 |
|------|------|------|
| 回归测试 | `tests/test_regression.py` | 33 条：match_clip/training_analysis/4健康检查/6 AI教练API/15 赛事API/4 训练日志扩展/2 analysis targeting |
| API 契约 | `docs/api-contract.md` | 前后端接口定义 |
| 后端 AGENTS | `AGENTS.md` | 项目文档 + 开发闭环工作流 |
| 前端 AGENTS | `AGENTS.md` | 项目文档 + 开发闭环工作流 |
| SPEC ai-talk | `docs/specs/SPEC-ai-talk.md` | AI教练对话模块设计 (2026-05-17 Jim) |
| 公共模块 | `utils/config.js` | 环境切换 |
| 公共模块 | `utils/video-cache.js` | 视频本地文件缓存 (LRU淘汰, 180MB) |
| 公共模块 | `utils/api.js` | 统一请求层 (get/post/upload/download) |
| 公共模块 | `utils/markdown.js` | Markdown→rich-text nodes 解析器 |
| 前端测试 | `tests/unit/markdown.test.js` | Markdown 解析器 16条用例 |
| SPEC video-lib | `docs/specs/SPEC-video-lib.md` | 视频库/对手/统计/赛事/认证 五模块完整设计 + 开发记录 (Howie) |

---

## 八、MVP 开发路线图 (v1.0)

### P0 — 本周：体验闭环 🔴

| 任务 | 内容 | 涉及 |
|------|------|------|
| 赛事数据接口 | ✅ `GET /api/events` + 爬虫框架 + 定时调度 + 详情页 | 后端 Express + 爬虫 | Alice |
| AI 评分报告 | ✅ 评分算法 v2 + 评分报告 UI (2026-05-19 Jack) | 后端 `pose_scorer.py` + 前端 analysis |
| 分享卡片 | 评分结果 + 训练建议生成可分享图片 | 前端 canvas |

### P1 — 两周：数据资产化 🟡

| 任务 | 内容 | 涉及 |
|------|------|------|
| 视频库 | ✅ 上传历史 + 筛选 + 详情 (Phase 1) | 后端 `GET /api/videos/*` + 前端 pages/video-lib | Howie |
| 对手档案 | ✅ 录入对手 → 关联视频 → 对战记录 (Phase 2) | 后端 `GET /api/opponents/*` + 前端 pages/opponent | Howie |
| 训练统计 | ✅ 评分趋势图 + 训练频次 + 薄弱项分析 (Phase 3) | 后端 `GET /api/analysis/stats` + 前端 training-stats | Howie |
| `/ask` HTTP | ✅ 已交付 (2026-05-18 Jim) Express POST /api/ask + 本地70B兜底 + 反馈/训练日志 API |

### P2 — 一月：社区增长 🟢

| 任务 | 内容 |
|------|------|
| 技术挑战系统 | 周挑战 → 上传视频 → AI 评分 → 排行榜 |
| AI 等级认证 | ✅ 训练分析自动评级 → 虚拟徽章 (Phase 5) | 后端 2 端点 + 前端 certification | Howie |
| 乒乓文档 CMS | 文章后台管理 + 前端详情页 |
| 赛事推荐 | 基于用户画像自动推荐合适赛事 |

### P3 — 两月：变现/深度 🔵

| 任务 | 内容 |
|------|------|
| 技战术深度分析 | 上传比赛视频 → 完整战术报告（落点热力图、得分模式） |
| 教练入驻 | 教练-学员绑定 + 远程标注 + 付费指导 |
| 视频广场 | 精彩分析视频社区展示 |

---

## 九、技术债务

| 项目 | 严重程度 | 说明 |
|------|---------|------|
| wx.getUserProfile 废弃 | 🔴 | 微信 2024 起废弃，需迁到新接口 |
| 后端未提交改动 | 🟡 | server.js/crawler.js/tech.js 等 9 个文件 (Jack 遗留) |

---

## 十一、运行检查清单

```bash
# 后端回归测试 (必须在 backend 容器内执行)
docker-compose exec backend pip install pytest -q
docker-compose exec backend pytest tests/test_regression.py -v
# 期望: 31 passed (32 if /ask 未偶发 404)

# 前端 Jest 测试
npx jest --verbose
# 期望: 125 passed, 6 suites
```
