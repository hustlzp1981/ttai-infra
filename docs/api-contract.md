# TT.AI API 接口契约

## 概述
本文档定义前后端所有 API 接口的请求/响应格式。新增接口时，前端先在此定义期望的 shape，后端按契约实现。

---

## 1. FastAPI 后端 (端口 5000)

### 1.1 根路径
GET /
响应: {" Hello": "World"}

### 1.2 初始化上传
GET /upload/init
参数 (Query):
 - file_name: string - 文件名 (含扩展名)
 - file_md5: string - 文件 MD5 值
响应:
 首次上传: {"uploaded": []}
 秒传(文件已存在): {"status": "completed", "task_id": "existing_file", "uploaded": []}
错误:
 400: 文件格式不支持 (仅 mp4/avi/mov)
 500: 服务器内部错误

### 1.3 分片上传
POST /upload/chunk
表单 (multipart/form-data):
 - file: binary - 分片二进制数据
 - chunk_index: string - 分片索引 (0-based)
 - file_md5: string - 文件整体 MD5
 - chunk_md5: string - 分片 MD5
响应:
 成功: {"success": true}
错误:
 400: MD5 校验失败
 500: 分片存储失败

### 1.4 完成上传
GET /upload/complete
参数 (Query):
 - file_name: string - 文件名
 - file_size: string - 文件大小(字节)
 - file_md5: string - 文件 MD5
 - mode: string - 处理模式: "match_clip" | "training_analysis"
响应:
 成功: {"task_id": "xxx", "message": "Merge process started"}
错误:
 400: 缺失分片 / 无效 mode
 500: 内部错误

### 1.5 查询任务状态
GET /status/{task_id}
响应 (pending):
 {"task_id": "...", "status": "pending", "progress": 0}
响应 (processing):
 {"task_id": "...", "status": "processing", "progress": 30}
响应 (completed):
 {
 "task_id": "...",
 "status": "completed",
 "progress": 100,
 "result": "output/md5/filename_output.mp4",
 "filename": "filename_output.mp4",
 "thumbnailUrl": "output/md5/thumbnail.jpg",
 "duration": 45.2,
 "size": 52428800,
 "clips": 12,
 "poseVideo": "output/md5/pose.mp4",
 "overlayTypes": [{"id": "all", "label": "全部"}, {"id": "skeleton", "label": "骨骼线"}, {"id": "fishbone", "label": "鱼骨线"}, {"id": "angles", "label": "角度"}, {"id": "none", "label": "无覆盖"}],
 "activeOverlay": "all",
 "overlayVideos": {"all": "...", "skeleton": "...", "fishbone": "...", "angles": "...", "none": "..."}
 }
training_analysis 模式还会额外返回:
 {"angleData": [45, 52, ...], "poseVideo": "..."}
响应 (failed):
 {"task_id": "...", "status": "failed", "message": "错误描述"}

### 1.6 下载文件
GET /download/{filepath}
响应: 200 + 文件二进制流
错误: 404 文件不存在 / 400 非法文件名

---

## 2. Express 微信后端 (端口 3000)

### 2.1 微信登录
POST /api/login
请求体: {"code":"...", "sessionId":"...", "rawData":"...", "signature":"...", "encryptedData":"...", "iv":"..."}
成功: {"code":0, "data":{"token":"JWT", "user":{"id":"","openid":"","nickname":"","avatarUrl":"","city":""}}}
失败: {"code":4004, "message":"..."}

### 2.2 WebSocket 技术交流
wss://www.ttcut.com/ws?sessionId={sessionId}
认证: {"type":"auth", "token":"...", "requestId":"..."}
提问: {"type":"question", "content":"...", "messageId":"...", "context":"..."}
流式响应: {"type":"partial", "content":"...", "messageId":"..."}
完整响应: {"type":"complete", "content":"...", "messageId":"..."}
错误: {"type":"error", "message":"..."}

### 2.3 HTTP 回退 (AI 问答)
POST /ask
请求体: {"model":"...", "messages":[...], "max_tokens":512, "temperature":0.7}
响应 (OpenAI 兼容): {"choices":[{"message":{"content":"..."}}]}

### 2.4 赛事列表查询
GET /api/events?month=2026-05&city=上海&type=youth&status=upcoming&page=1&pageSize=20
参数 (Query, 均为可选):
 - month: string - 月份过滤 (YYYY-MM)
 - city: string - 城市模糊匹配
 - type: string - 赛事类型 (international/domestic/youth)
 - status: string - 状态 (upcoming/ongoing/past)
 - page: int - 页码 (默认1)
 - pageSize: int - 每页条数 (默认20)
响应:
 {
   "code": 0,
   "data": {
     "items": [{
       "id": "...",
       "name": "上海市青少年乒乓球公开赛",
       "date": "2026-05-24",
       "endDate": null,
       "location": "上海市体育馆",
       "city": "上海",
       "province": "",
       "type": "youth",
       "category": "U15",
       "org": "上海市乒协",
       "url": "",
       "registrationUrl": "",
       "registrationDeadline": null,
       "source": "ctta",
       "status": "upcoming",
       "level": "intermediate",
       "ageGroup": "U15",
       "cost": 0
     }],
     "total": 7,
     "page": 1,
     "pageSize": 20
   }
 }

### 2.5 青少年赛事搜索
GET /api/competitions/search?keyword=锦标赛&city=上海&source=ctta&status=upcoming
参数 (Query, 均为可选):
 - keyword: string - 关键词 (名称/城市/主办方模糊匹配)
 - city: string - 城市过滤
 - source: string - 来源 (ctta/aijuwang/kaiqiuwang)
 - status: string - 状态 (upcoming/ongoing/past)
响应:
 {
   "code": 0,
   "data": {
     "items": [{
       "id": "...",
       "name": "上海市中小学生乒乓球冠军赛",
       "date": "2026-05-24",
       "city": "上海",
       "category": "U11/U13/U15",
       "org": "上海市乒协",
       "source": "ctta",
       "status": "upcoming",
       "level": "intermediate",
       "ageGroup": "U15",
       "cost": 80
     }],
     "total": 1,
     "lastRefresh": "2026-05-17T10:00:00Z"
   }
 }

### 2.6 赛事平台入口
GET /api/competitions/platforms
响应:
 {
   "code": 0,
   "data": {
     "platforms": [
       { "key": "ctta", "name": "中国乒乓球协会", "desc": "...", "url": "https://www.ctta.cn", "icon": "🏛️" },
       { "key": "aijuwang", "name": "爱聚网", "desc": "...", "url": "https://www.aijuwang.net", "icon": "🏓" },
       { "key": "kaiqiuwang", "name": "开球网", "desc": "...", "url": "https://www.kaiqiuwang.com", "icon": "🎯" },
       { "key": "pingsaitong", "name": "乒赛通", "desc": "...", "url": "", "icon": "📋" }
     ]
   }
 }

### 2.7 八大杯赛信息
GET /api/competitions/eightcups
响应:
 {
   "code": 0,
   "data": {
     "name": "全国少儿乒乓球八大杯赛",
     "desc": "...",
     "cups": [
       { "name": "创新杯", "founded": 1980, "desc": "..." },
       ...
     ]
   }
 }

### 2.8 智能赛事推荐
POST /api/competitions/recommend
请求体:
 {
   "age": 12,
   "level": "intermediate",
   "style": "loop",
   "budget": 500,
   "city": "上海"
 }
响应:
 {
   "code": 0,
   "data": {
     "profile": {
       "age": 12,
       "level": "intermediate",
       "levelLabel": "中级（有比赛经验，能稳定对攻）",
       "style": "loop",
       "styleLabel": "弧圈型，擅长正手拉球和前冲弧圈",
       "budget": 500,
       "city": "上海"
     },
     "recommendations": [{
       "id": "...",
       "name": "上海市中小学生乒乓球冠军赛",
       "city": "上海",
       "date": "2026-05-24",
       "category": "U11/U13/U15",
       "org": "上海市乒协",
       "source": "ctta",
       "status": "upcoming",
       "level": "beginner",
       "cost": 80,
       "score": 92,
       "reasons": ["同城", "年龄匹配", "水平接近", "预算内"]
     }],
     "total": 5
   }
 }

---

## 3. 通用约定

### 3.1 认证
- 除下载和 WebSocket 外，请求需带 Header: Authorization: Bearer <token>
- Token 由 /api/login 返回，有效期 7 天

### 3.2 分片约定
- 分片大小: 10MB
- 最大并发上传: 3
- 文件格式: 仅 .mp4 .avi .mov

### 3.3 nginx 路由表
| 路径 | 目标服务 | 端口 |
|-------------|-----------------|------|
| / | web 前端 | 80 |
| /upload/* | backend (FastAPI)| 5000 |
| /status/* | backend (FastAPI)| 5000 |
| /download/* | backend (FastAPI)| 5000 |
| /ws | wechat (Express) | 3000 |
| /api/* | wechat (Express) | 3000 |

### 2.9 赛事详情
GET /api/events/:id
响应:
 {
    code: 0,
   data: {
     id: ...,
     name: 上海市中小学生乒乓球冠军赛,
     date: 2026-05-24,
     endDate: null,
     location: 上海市体育馆,
     city: 上海,
     type: youth,
     category: U11/U13/U15,
     org: 上海市乒协,
     registrationUrl: ,
 registrationDeadline: null,
 source: ctta,
 status: upcoming,
 level: beginner,
 ageGroup: U15,
 cost: 80
 }
 }

### 2.10 手动刷新赛事数据
GET /api/events/refresh
说明: 触发爬虫拉取各数据源新增赛事，去重后入库。
响应:
 {
 code: 0,
 data: { fetched: 5, new: 2, timestamp: 2026-05-17T02:00:00Z }
 }

---

## 3. 视频库/对手/训练统计 API (2026-05-17 | Howie)

### 3.1 视频自动入库
POST /api/videos/register
请求头: Authorization: Bearer <token>
请求体: { taskId, title, mode, filename, thumbnailUrl, duration, size, tags }
响应: { code: 0, data: { id: 'xxx' }, message: '入库成功' }

### 3.2 视频列表
GET /api/videos/list?page=1&pageSize=12&mode=match_clip&opponentId=xxx&keyword=正手&dateFrom=2026-05-01&dateTo=2026-05-31
请求头: Authorization: Bearer <token>
响应: { code: 0, data: { items: [{ id, taskId, title, mode, thumbnailUrl, duration, opponentId, opponentName, tags, date, scores, size }], total, page, pageSize } }

### 3.3 视频详情
GET /api/videos/detail?id=xxx
请求头: Authorization: Bearer <token>
响应: { code: 0, data: { id, taskId, title, filename, mode, thumbnailUrl, videoUrl, duration, size, opponent, tags, date, scores, advice, angleData, poseVideo, overlayVideos, clips } }

### 3.4 更新视频信息
POST /api/videos/update
请求头: Authorization: Bearer <token>
请求体: { id, title?, opponentId?, tags? }
响应: { code: 0, message: '更新成功' }

### 3.5 删除视频 (软删除)
POST /api/videos/delete
请求头: Authorization: Bearer <token>
请求体: { id }
响应: { code: 0, message: '删除成功' }

### 3.5.1 视频公开分享
POST /api/video-shares
请求头: Authorization: Bearer <token>
说明: 用户主动从视频库/沉浸式播放器生成可公开查看的只读分享短码；原视频仍保持私有，只有持短码者可看分享快照。
请求体: { videoId: string, title?: string, coverImage?: string, currentClipIndex?: number, envVersion?: "develop"|"trial"|"release", source?: "poster" }
响应: { code: 0, data: { shareId, code, title, summary, coverImage, sharePath, qrUrl, expiresAt } }

GET /api/video-shares/detail?code=xxx
请求头: 无需 Authorization
说明: 公开只读分享详情；若本机有过期 token，前端也不应携带 Authorization，避免公开页被旧登录态拦截。
响应: { code: 0, data: { id, code, title, summary, coverImage, owner: { nickname, avatarUrl }, snapshot: { id, taskId, realTaskId, title, mode, thumbnailUrl, videoUrl, duration, clipCount, clips, scores, advice, angleData, matchRallies, initialClipIndex? }, createdAt, expiresAt } }
错误: 400 缺少分享参数 / 404 分享不存在或已撤回 / 410 分享已过期或原视频已删除

GET /api/share-qrcode?scene=vs%3Dxxx&page=pages%2Fvideo-share%2Fdetail&env_version=trial
说明: 生成小程序码；`env_version` 可选 `develop/trial/release`，默认 `release`。体验版公开视频分享必须传 `trial`，否则扫码会打开正式版。

### 3.6 对手列表
GET /api/opponents/list?page=1&pageSize=20&keyword=张
请求头: Authorization: Bearer <token>
响应: { code: 0, data: { items: [{ id, name, style, styleLabel, level, levelLabel, city, matchCount, record: { win, loss }, winRate, lastMatch, videoCount }], total } }

### 3.7 对手详情
GET /api/opponents/detail?id=xxx
请求头: Authorization: Bearer <token>
响应: { code: 0, data: { id, name, style, level, city, notes, stats: { totalMatches, win, loss, winRate }, recentVideos, recentMatches } }

### 3.8 录入/编辑对手
POST /api/opponents/save
请求头: Authorization: Bearer <token>
请求体: { id?: null, name, style?, level?, city?, notes? }
响应: { code: 0, data: { id }, message: '录入成功'|'更新成功' }

### 3.9 删除对手 (软删除)
POST /api/opponents/delete
请求头: Authorization: Bearer <token>
请求体: { id }
响应: { code: 0, message: '删除成功' }

### 3.10 对战记录列表
GET /api/matches/list?opponentId=xxx&page=1&pageSize=20
请求头: Authorization: Bearer <token>
响应: { code: 0, data: { items: [{ id, opponentId, opponentName, videoId, thumbnailUrl, date, result, myScore, opponentScore, event, notes }], total } }

### 3.11 录入/编辑对战记录
POST /api/matches/save
请求头: Authorization: Bearer <token>
请求体: { id?: null, opponentId, videoId?, date, result: win|loss|draw, myScore, opponentScore, event?, notes? }
响应: { code: 0, data: { id }, message }

### 3.12 删除对战记录 (软删除)
POST /api/matches/delete
请求头: Authorization: Bearer <token>
请求体: { id }
响应: { code: 0, message: '删除成功' }

### 3.13 训练统计概览
GET /api/analysis/stats?days=30
请求头: Authorization: Bearer <token>
响应: { code: 0, data: { totalAnalyses, thisMonth, thisWeek, avgScore, scoreTrend: [{ date, score }], frequencyByWeek: [{ week, count }], dimensionTrend: { forehand: [], backhand: [], footwork: [], balance: [] }, weakPoints: [], advice } }

### 2.3 HTTP 回退 (AI 问答) — 已升级
POST /ask
请求体: {
  messages: [{ role:  user, content: 如何提高正手拉球稳定性？ }],
  context: { skillLevel: 中级, playStyle: 弧圈 },
  followUpCount: 3
}
响应:
{
  code: 0,
  data: {
    content: 针对中级选手正手拉球稳定性问题...\\n1. **重心转移**...,
    followUps: [正手拉球常见错误有哪些？, 如何练习正手拉球的弧线控制？, 正手拉球 vs 正手快攻的区别？],
    logEntry: {
      type: training_summary,
      tags: [正手, 拉球],
      summary: AI教练咨询记录
    }
  }
}
错误:
  400: 缺少messages参数
  500: AI服务暂不可用

### 2.11 AI对话消息反馈 (2026-05-17 | Jim)
POST /api/chat/feedback
请求体: { messageId: ai-xxx, rating: 1, sessionId: uuid }
说明: rating=1 点赞, rating=-1 点踩
响应: { code: 0, data: { id: mongo-object-id } }
错误: 400 rating无效或缺少参数

### 2.12 会话历史列表 (2026-05-17 | Jim)
GET /api/chat/sessions
响应: { code: 0, data: { items: [], total: 0 } }

### 2.13 训练日志 CRUD (2026-05-17 | Jim)
GET /api/chat/training-log?sessionId=xxx
说明: sessionId可选，不传则返回用户全部日志
响应: { code: 0, data: { entries: [{ _id, userId, date, type, tags, content, aiAdvice, createdAt }], total } }

POST /api/chat/training-log
请求体: { sessionId?, date?, type?, tags?, content, aiAdvice? }
响应: { code: 0, data: { _id, userId, date, type, tags, content, aiAdvice, createdAt } }
错误: 400 content缺失

DELETE /api/chat/training-log/:id
响应: { code: 0 }

---

## 4. 俱乐部教务管理

### 4.1 导入学员 Excel (2026-06-29)
POST /api/club-admin/edu/students/import
请求头: Authorization: Bearer <token>
请求体: multipart/form-data
- clubId: string - 俱乐部 id 或 slug
- file: binary - 学员表，支持 `.xlsx`、`.xlsm`、Web 学员管理导出的表格型 `.xls`、CSV

导入字段:
- 学员/姓名/学员姓名: 学员姓名，必填
- 分店/所属分店/校区: 分店名称或分店 id，可选；为空时使用当前管理员可访问的默认分店
- 手机号/手机/联系电话: 学员手机号，可选
- 家长/家长姓名/监护人: 家长姓名，可选
- 家长手机号/家长手机: 家长手机号，可选
- 水平/等级: 初级、入门、中级、高级、专业、精英，或已有内部值
- 状态: 在读、启用、正常、停用、归档；为空默认在读
- 来源、备注: 可选

去重规则:
- 优先按同俱乐部、非归档学员的手机号去重。
- 无手机号时，按同俱乐部、同分店、同学员姓名、同家长姓名去重；家长为空时匹配家长为空或未设置的学员。
- 重复行跳过，不覆盖已有学员。

响应:
```
{
  "code": 0,
  "data": {
    "totalRows": 2,
    "createdCount": 1,
    "skippedCount": 1,
    "errorCount": 0,
    "created": [{ "line": 2, "id": "mongo-object-id", "name": "张三" }],
    "skipped": [{ "line": 3, "name": "张三", "reason": "重复学员已跳过", "duplicateId": "mongo-object-id" }],
    "errors": []
  }
}
```
错误:
- 400: 未选择文件、文件无法解析或学员姓名缺失
- 401: 未登录
- 403: 无教务学员写权限或无分店权限
