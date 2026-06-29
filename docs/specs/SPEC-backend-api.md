# SPEC-3: 后端 API 设计完整清单

> 关联: STATUS.md, SPEC-frontend.md, api-contract.md | 位置: ~/workspace/tt.ai/docs/specs/
> 最后更新: 2026-05-17 Alice (赛事 API 状态更新)

---

## 一、已有 API（已实现）

### FastAPI (:5000)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | / | 健康检查 | ✅ |
| GET | /upload/init | 初始化分片上传 | ✅ |
| POST | /upload/chunk | 上传单个分片 | ✅ |
| GET | /upload/complete | 完成上传→触发Celery处理 | ✅ |
| GET | /status/{task_id} | 查询任务处理进度 | ✅ |
| GET | /download/{path} | 下载处理结果文件 | ✅ |

### Express (:3000)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | /api/login | 微信登录 | ✅ |
| WebSocket | /ws?sessionId= | AI 对话 | ✅ |
| GET/POST | /api/user | 用户资料 CRUD | ✅ |
| POST | /api/feedback | 反馈提交 | ✅ |
| POST | /api/generate-qrcode | 生成小程序码 | ✅ |
| **赛事 API** | | | |
| GET | /api/events | 赛事列表 (month/city/type/status/page) | ✅ |
| GET | /api/events/:id | 赛事详情 | ✅ |
| GET | /api/events/refresh | 手动触发爬虫 | ✅ |
| GET | /api/competitions/search | 青少年赛事搜索 (keyword/city/source) | ✅ |
| POST | /api/competitions/recommend | AI 智能推荐 | ✅ |
| GET | /api/competitions/platforms | 赛事平台入口 | ✅ |
| GET | /api/competitions/eightcups | 八大杯赛信息 | ✅ |
| POST | /api/video-shares | 创建视频公开分享短码 | ✅ |
| GET | /api/video-shares/detail?code= | 公开只读视频分享详情 | ✅ |
| POST | /api/club-admin/edu/students/import | 管理端导入学员 Excel，按手机号/学员信息去重 | ✅ |

---

## 二、P0 待实现 API（本周）

### 2.1 AI 评分报告

```
POST /api/analysis/report
说明: 基于已完成的训练分析视频，生成AI量化评分报告
Body: { taskId: string }
Response:
{
  code: 0,
  data: {
    overallScore: 78,
    dimensions: {
      forehand: { score: 82, label: "正手", comment: "力量充足，角度偏小" },
      backhand: { score: 75, label: "反手", comment: "稳定性需提升" },
      footwork: { score: 70, label: "步伐", comment: "左右移动偏慢" },
      balance: { score: 85, label: "重心", comment: "控制良好" }
    },
    keyframes: [
      { time: 2.3, frameUrl: "output/xxx/frame_2.3.jpg", angles: { waist: 45, knee: 52 } },
      { time: 5.1, frameUrl: "output/xxx/frame_5.1.jpg", angles: { waist: 48, knee: 55 } }
    ],
    advice: {
      focus: "反手拧拉",
      drills: ["3组×20次反手拧拉", "2组×15次反手变线练习"],
      expectedImprovement: "坚持2周预计反手评分可提升至82",
      tips: "注意手腕发力时机，击球点靠前"
    },
    comparedTo: {
      reference: "马龙 训练示范",
      similarity: 72,
      mainGap: "反手拧拉角度差 8°"
    }
  }
}
实现: app/models/pose_analyzer.py 扩展 + new route in app/main.py
```

### 2.2 AI 对话 HTTP 回退

```
POST /ask
说明: 当 WebSocket 不可用时的 HTTP fallback (AI 教练对话)
Body: {
  model: "Qwen/Qwen3-8B",
  messages: [{ role: "user", content: "如何提高反手拧拉？" }],
  max_tokens: 512,
  temperature: 0.7
}
Response (OpenAI 兼容):
{
  choices: [{ message: { role: "assistant", content: "要提高反手拧拉..." } }]
}
实现: wechat-backend/src/ask.js (新建，复用 tech.js 的 AI 调用逻辑)
```

---

## 三、P1 待实现 API（两周内）

### 3.1 赛事数据 — ✅ 已完成 (2026-05-17 Alice)

```
已实现:
  ✅ GET /api/events         — 赛事列表 (month/city/type/status 筛选 + 分页)
  ✅ GET /api/events/:id     — 赛事详情
  ✅ GET /api/events/refresh — 手动触发爬虫
  ✅ GET /api/competitions/search     — 青少年赛事搜索
  ✅ POST /api/competitions/recommend — 智能推荐 (含评分算法)
  ✅ GET /api/competitions/platforms  — 赛事平台入口
  ✅ GET /api/competitions/eightcups  — 八大杯赛信息

数据: MongoDB events 集合, 54条种子数据
爬虫: wechat-backend/src/crawler.js, 每日凌晨2点定时调度
详情: 见 SPEC-competition.md
```

### 3.2 青少年赛事搜索 — ✅ 已完成

> 见 3.1，已合并实现。

### 3.3 赛事智能推荐 — ✅ 已完成

> 见 3.1，已合并实现。推荐算法: score = 城市匹配(30) + 年龄匹配(20) + 水平匹配(25/15) + 预算匹配(15) + 状态加分(10/5/0)

### 3.4 用户 Dashboard

```
GET /api/dashboard
说明: 首页个性化数据聚合
认证: Bearer token
Response:
{
  code: 0,
  data: {
    greeting: "下午好！",
    user: { nickname, level, style, avatarUrl },
    streak: 5,
    trainingTip: { text: "...", sourceTaskId: "abc123" },
    upcomingEvent: { name: "...", date: "...", daysLeft: 7, city: "...", category: "..." },
    stats: { totalAnalyses: 12, thisWeek: 3, avgScore: 78 }
  }
}
```

### 3.5 分析历史

```
GET /api/analysis/history
说明: 用户训练分析历史记录
认证: Bearer token
参数: days=30, page=1, mode=match_clip|training_analysis
Response:
{
  code: 0,
  data: {
    items: [{ taskId, mode, thumbnailUrl, duration, score, angleData, date }],
    total: 12,
    trend: { scores: [72, 75, 78, 76, 80], dates: ["5/10", "5/12", ...] }
  }
}
```

### 3.6 用户统计

```
GET /api/user/stats
认证: Bearer token
Response:
{ code: 0, data: { totalAnalyses: 12, opponentsCount: 5, eventsCount: 3 } }
```

### 3.7 视频库

```
GET /api/videos/list
认证: Bearer token
参数: page=1, mode, opponent, tag, keyword
Response:
{
  code: 0,
  data: {
    items: [{ id, thumbnailUrl, duration, mode, opponent, date, tags, score }],
    total: 25,
    page: 1
  }
}

POST /api/videos/{id}/tag
Body: { tags: ["比赛", "反手"], opponent: "张三" }
Response: { code: 0 }
```

### 3.7.1 视频公开分享 — ✅ 已完成 (2026-06-23 Codex)

```
POST /api/video-shares
说明: 登录用户主动从个人视频库创建公开视频分享短码。原视频仍为私有资产，公开页只读展示分享快照。
认证: Bearer token
Body: { videoId: string, title?: string, coverImage?: string, currentClipIndex?: number, envVersion?: "develop"|"trial"|"release", source?: "poster" }
Response: { code: 0, data: { shareId, code, title, summary, coverImage, sharePath, qrUrl, expiresAt } }

GET /api/video-shares/detail?code=short-code
说明: 公开视频分享详情。无需登录，不携带 Authorization；短码本身为 bearer 凭据。
Response: {
  code: 0,
  data: {
    id, code, title, summary, coverImage,
    owner: { nickname, avatarUrl },
    snapshot: {
      id, taskId, realTaskId, title, mode, thumbnailUrl, videoUrl,
      duration, clipCount, clips, scores, advice, angleData,
      matchRallies, initialClipIndex?
    },
    createdAt, expiresAt
  }
}
```

`/api/share-qrcode` 支持 `env_version=develop|trial|release`，默认 `release`。体验版分享海报必须由前端传当前小程序 `envVersion=trial`，否则小程序码会打开正式版。

### 3.8 对手管理

```
POST /api/opponents
Body: { name, style, level, notes }
Response: { code: 0, data: { id: "xxx" } }

GET /api/opponents/list
Response: { code: 0, data: { items: [{ id, name, record, lastMatch }] } }

GET /api/opponents/{id}
Response: { code: 0, data: { id, name, record: {win,loss}, videos: [...], aiSummary: ... } }
```

---

## 四、P2 待实现 API（一月内）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/docs/list | 乒乓文档列表 |
| GET | /api/docs/{id} | 文档详情 |
| GET | /api/challenges/current | 当前挑战 |
| POST | /api/challenges/{id}/submit | 提交挑战视频 |
| GET | /api/challenges/{id}/leaderboard | 排行榜 |
| POST | /api/tactics/analyze | AI 战术分析 |
| GET | /api/tactics/{id} | 战术分析详情 |

---

## 五、数据模型

### MongoDB Collections

**wechat_user** (已有)
```
{ openid, unionid, nickname, gender, city, avatar, skillLevel, playStyle, playYear, club, contact, lastLogin }
```

**wechat_feedback** (已有)
```
{ content, contact, createdAt }
```

**events** (新增 — ✅ 已实现)
```
文件: wechat-backend/src/models/event.js
集合: events (54条种子数据)
{
  name: String (required, 索引),
  date: Date (required, 索引),
  endDate: Date,
  location: String,
  city: String (索引),
  province: String,
  type: String (enum: international/domestic/youth/open),
  category: String,
  org: String,
  url: String,
  registrationUrl: String,
  registrationDeadline: Date,
  source: String (enum: ctta/aijuwang/kaiqiuwang/pingsaitong/manual),
  sourceUrl: String,
  status: String (enum: upcoming/ongoing/past),
  level: String (enum: beginner/intermediate/advanced/pro),
  ageGroup: String,
  cost: Number (default 0),
  crawledAt: Date,
  createdAt: Date,
  updatedAt: Date
}
复合索引: { city: 1, date: 1 }, { type: 1, date: 1 }
```

**videos** (待实现)
```
{ userId, taskId, thumbnailUrl, fileUrl, duration, fileSize, mode, clips, date, opponentId, tags: [], score, angleData: [] }
```

**opponents** (待实现)
```
{ userId, name, style, level, notes, record: { win: 0, loss: 0 }, createdAt }
```

**challenges** (待实现)
```
{ title, type, startDate, endDate, status, participants: [{ userId, taskId, score, rank }] }
```

**docs** (待实现)
```
{ title, content, category, level, author, tags, likes, reads, createdAt }
```
