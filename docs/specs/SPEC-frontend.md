# SPEC-2: 前端模块详细设计

> 关联: STATUS.md | 位置: `miniprogram-ttai/docs/specs/`
> 最后更新: 2026-05-17 Alice (Module C 更新)

---

## Module A: 首页 Dashboard (pages/index)

### 当前状态
- 4 个快捷入口卡片
- 处理中任务卡片（读取 taskStatus）
- 最近分析列表（读取 localStorage taskStatus）
- 分享邀请卡片 + FAB 上传按钮

### 设计目标 (v1.0)
```
数据源: GET /api/dashboard → { trainingTip, upcomingEvents, stats, streak }

页面布局:
┌─ 欢迎区 ─────────────────────┐
│ 头像 + "你好，XXX" + 连续打卡天数│
└──────────────────────────────┘
┌─ 训练建议卡片 (有则显示) ──────┐
│ 🎯 "正手角度偏小，建议..."      │
│ [查看详细报告]                  │
└──────────────────────────────┘
┌─ 快捷操作 (4宫格) ────────────┐
│ 🎬上传分析 │ 📅赛事日历        │
│ 💬AI教练   │ 📊训练统计        │
└──────────────────────────────┘
┌─ 近期赛事 (1-2条) ────────────┐
│ 5.24 上海市青少年公开赛 U15    │
│ [查看详情] [报名]              │
└──────────────────────────────┘
┌─ 训练趋势图 ─────────────────┐
│ [本周分析次数柱状图]           │
│ [最近评分折线图]               │
└──────────────────────────────┘
┌─ FAB [🎬 上传视频分析] ───────┘
```

### 数据需求
```
GET /api/dashboard
Response:
{
  code: 0,
  data: {
    greeting: "下午好，小张！",
    streak: 5,          // 连续打卡天数
    trainingTip: {
      text: "正手角度偏小，建议本周增加反手拧拉专项练习",
      sourceTaskId: "abc123"
    },
    upcomingEvent: {
      name: "上海市青少年乒乓球公开赛",
      date: "2026-05-24",
      daysLeft: 7,
      city: "上海",
      category: "U15"
    },
    stats: {
      totalAnalyses: 12,
      thisWeek: 3,
      avgScore: 78,
      scoreTrend: [72, 75, 78]
    }
  }
}
```

---

## Module B: 视频分析 (pages/analysis)

### 当前状态
- 2 个子标签：比赛回合剪辑 | 训练视频分析
- 完整上传+处理+结果展示管线
- 比赛回合剪辑：下载视频 + 选择片段下载 + 信息面板
- 训练视频分析：下载视频 + 4位参考运动员对比 + 覆盖层 + 角度数据
- 代码: ~970 行 (待拆分)

### 设计目标 (v1.0) — 训练分析增强

```
训练视频分析 → 完成后展示：

[AI 评分报告卡片]          ← 新增
├─ 综合评分: 78/100
├─ 维度: 正手82 | 反手75 | 步伐70 | 重心85
├─ vs 上次: ↑3分
└─ [分享卡片]

[关键帧分析]               ← 新增
├─ 击球瞬间 3 帧（左右滑动）
├─ 每帧标注关节角度/拍面角度
└─ 与参考运动员同帧对比

[角度对比曲线]              ← 新增
├─ 雷达图：自己 vs 马龙 vs 樊振东
└─ 趋势线：最近5次训练

[AI 训练建议]               ← 新增
├─ 本周重点: 反手拧拉
├─ 练习方案: 3组×20次
└─ [开始训练] → 跳转训练日志

[对比分析区]                ← 保持现有
├─ 参考视频选择器
├─ 双视频对比 (覆盖层)
└─ 角度数据 + AI 对比结论
```

### 数据需求
```
POST /api/analysis/report
Body: { taskId }
Response:
{
  code: 0,
  data: {
    overallScore: 78,
    dimensions: {
      forehand: 82,
      backhand: 75,
      footwork: 70,
      balance: 85
    },
    keyframes: [
      { time: 2.3, imageUrl: "...", angles: {...} },
      { time: 5.1, imageUrl: "...", angles: {...} },
      { time: 8.7, imageUrl: "...", angles: {...} }
    ],
    advice: {
      focus: "反手拧拉",
      exercises: ["3组×20次反手拧拉", "2组×15次反手变线"],
      expectedImprovement: "2周内反手提升至82"
    },
    angleData: [45, 52, 48, ...],
    overlayVideos: { skeleton: "...", fishbone: "...", ... }
  }
}
```

---

## Module C: 发现 (pages/discover) ← 2026-05-17 更新

### 当前状态 (已实现)
6 个子标签，文件结构:

```
pages/discover/
├── discover.js       — 主页面逻辑 (已重构: 引入 config, API 调用)
├── discover.wxml     — 模板 (新增 onYouthEventTap)
├── discover.wxss     — 样式
├── discover.json     — 页面配置
└── event-detail/     — 赛事详情页 (新增, 4文件)
    ├── event-detail.js
    ├── event-detail.wxml
    ├── event-detail.wxss
    └── event-detail.json
```

### C1: 赛事日历 (events) — ✅ 100%
```
数据源: GET /api/events?month=2026-05&type=youth (从 MongoDB 实时查询)
前端: initEvents() 已重写, 去除 17 条硬编码

已实现:
  ✅ 月份滑动选择器 (未来12个月, initEvents 动态生成)
  ✅ 分类筛选 (全部/国际/国内/青少年 → fetchEvents() 带 type 参数)
  ✅ 赛事卡片: 名称 + 日期 + 地点 + 状态标签
  ✅ 点击跳转详情页: event-detail/event-detail?id=xxx
  ✅ 使用 config.baseUrl (不再硬编码 https://www.ttcut.com)
```

### C2: 青少年赛事 (youth) — ✅ 100%
```
数据源:
  GET /api/competitions/search?city=&keyword=  (主列表)
  POST /api/competitions/recommend              (智能推荐)

已实现:
  ✅ 城市选择器 (48个城市, 前端硬编码列表)
  ✅ 关键词搜索 → fetchCompetitions()
  ✅ 赛事卡片: 城市+日期+名称+类别+主办方 → 点击跳转详情页
  ✅ 平台入口区 (中国乒协/爱聚网/开球网/乒赛通) → URL 复制
  ✅ 智能推荐表单: 年龄/水平/打法/预算 → submitRecommend() → fetchRecommend()
  ✅ AI 推荐结果展示: score + reasons 标签
  ✅ 数据刷新按钮 — onYouthRefresh()
  ✅ 所有 API 调用改用 config.baseUrl
```

### C3: 技术挑战 (challenges) — 🔲 20%
```
当前: 2 张静态卡片 ("正手连续拉球挑战" + "反手拧拉速度挑战")
目标:
  GET  /api/challenges/current          → 当前进行中挑战
  POST /api/challenges/{id}/submit      → 提交视频
  GET  /api/challenges/{id}/leaderboard → 排行榜
```

### C4: 视频广场 (videos) — 🔲 10%
```
当前: 4 张空白占位卡片
目标: 精选分析视频展示 + 播放
```

### C5: 技战术分析 (tactics) — 🔲 10%
```
当前: 4 张静态卡片 (樊振东/孙颖莎/马龙/张本智和)
目标: 后端生成真实 AI 分析报告
```

### C6: 乒乓文档 (docs) — ✅ 45%
```
当前:
  - docs API 已接入
  - 文档详情页已接入
  - refresh-docs.js 已能抓取 中国乒协政策法规专区 + 搜狗微信专业内容
  - 已有 published/candidate 候选池机制

列表设计:
  - 分类筛选: 官方规程 / 技术进阶 / 战术策略 / 训练青训 / 器材装备 / 综合阅读
  - 卡片字段: 标题 + 摘要 + 来源 + 阅读时长/阅读量

详情页:
  - 标题 + 来源 + 时间 + 阅读时长
  - 正文 rich-text
  - 点赞
  - 原文入口

目标:
  - 像《乒乓世界》一样做成“专业内容阅读库”，而不是资讯流
  - 继续补专题合集 / 本周精选 / 内容质量筛选
```

```
GET  /api/docs/list?cat=official&page=1
GET  /api/docs/{id}
POST /api/docs/{id}/like
GET  /api/docs/refresh
```

### 关键实现细节
```
数据流:
  discover.js onLoad()
  ├── initEvents() → generate month selector → fetchEvents()
  │   └── wx.request GET /api/events?month=YYYY-MM&type=X
  │       └── setData({ filteredEvents })
  ├── initYouth() → set cities + platforms (static)
  └── fetchCompetitions()
      └── wx.request GET /api/competitions/search?city=&keyword=
          └── setData({ youthFiltered })

卡片点击:
  onEventTap / onYouthEventTap
  └── wx.navigateTo /pages/discover/event-detail/event-detail?id=xxx
      └── event-detail.js fetchEventDetail(id)
          └── wx.request GET /api/events/:id
              └── setData({ event })

关注提醒:
  onRemind() → wx.requestSubscribeMessage (→ localStorage 降级)
```

---

## Module D: 我的 (pages/profile)

### 当前状态
- 用户信息卡片 + 资料编辑表单
- 数据概览（分析次数/对手/赛事，均为 0）
- 5 个资产入口（视频库/对手/统计/赛事/等级，均"即将上线"）
- 系统菜单（设置/反馈/FAQ/关于）+ 退出登录

### 设计目标 (v1.0)

```
数据概览(动态):
├─ 分析次数: → GET /api/user/stats
├─ 对手数: → GET /api/opponents/count
└─ 参赛数: → GET /api/user/events/count

我的视频库 (Phase 1):
├─ GET /api/videos/list?page=1
├─ 视频卡片: 缩略图 + 标题 + 日期 + 标签 + 对手
├─ 筛选: 比赛/训练 | 按对手 | 按日期
└─ 点击 → 回放分析结果

对手档案 (Phase 1):
├─ GET /api/opponents/list
├─ 对手卡片: 姓名 + 对战次数 + 胜率
├─ 点击 → 对手详情: 所有对战视频 + AI分析总结
└─ POST /api/opponents → 录入新对手

训练统计 (Phase 1):
├─ GET /api/analysis/history?days=30
├─ 评分趋势折线图
├─ 训练频次柱状图
└─ 薄弱项分析 (AI生成)
```

### 数据需求
```
GET /api/user/stats
Response: { code: 0, data: { totalAnalyses: 12, opponentsCount: 5, eventsCount: 3 } }

GET /api/videos/list?page=1&mode=match_clip&opponent=张三
Response: {
  code: 0,
  data: {
    items: [{ id, thumbnailUrl, duration, mode, opponent, date, tags }],
    total: 25,
    page: 1
  }
}

GET /api/opponents/list
Response: {
  code: 0,
  data: {
    items: [{ id, name, record: { win: 3, loss: 2 }, lastMatch: "2026-05-10" }]
  }
}
```
