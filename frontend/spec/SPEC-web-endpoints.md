# Web 前端接口复用清单 (不改后端) — 最终版

更新时间: 2026-06-02 ARCH (review 修正)

> 仅列出现有可复用接口，Web 端只做调用，不新增/改动接口。

## 1. 登录与鉴权

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/generate-qrcode` | POST | 生成微信扫码登录二维码 |
| `wss://www.ttcut.com/ws` | WebSocket | 扫码登录完成后推送 auth_success |
| `/api/user/quota` | GET | 获取配额、段位、剩余次数 |
| `/api/user` | GET | 获取用户资料 (昵称/头像) |
| `/api/user` | POST | 更新用户资料 |

## 2. 上传与分析 —阿里云 upload-local 分片上传

> **关键**: Web 端必须走阿里云 Express 的 `upload-local` 路径，不能走 1.238 的旧 `/upload/` 路径。
> 阿里云路径会本地合并文件、生成缩略图、写入 MongoDB；旧路径绕过所有这些。

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/upload-local/init` | GET | `file_name`, `file_md5`, `openid` | 初始化分片上传，返回已上传分片列表 |
| `/api/upload-local/chunk` | POST | multipart: `file`, `chunk_index`, `file_md5` | 上传单个分片 (Web 端用 fetch + FormData) |
| `/api/upload-local/complete` | POST | JSON: `file_name`, `file_md5`, `file_size`, `mode`, `openid` | 合并分片并返回 taskId |
| `/api/upload-local/status/{localTaskId}` | GET | — | 轮询分析状态，Express 桥接到 FastAPI |

## 3. 媒体下载

| 端点 | 说明 |
|------|------|
| `/api/download-media/{taskId}/{filename}` | 通用媒体下载 (merged.mp4, clip_*.mp4, thumb.jpg, all.mp4, angles.mp4 等) |

## 4. 视频库

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/videos/list?page=&pageSize=&mode=` | GET | 视频列表，支持 mode 筛选 |
| `/api/videos/detail?id=` | GET | 视频详情 |
| `/api/videos/register` | POST | 分析完成后注册到视频库 |
| `/api/videos/update` | POST | 更新视频 (标题等) |
| `/api/videos/delete` | POST | 删除视频 |

## 5. 训练统计

| 端点 | 说明 |
|------|------|
| `/api/stats?days=30` | 双维度数据: `{ training: {...}, ai: {...} }` |

## 6. AI 教练

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ask` | POST | AI 问答 |
| `/api/chat/training-log` | GET/POST/PUT | 训练日志 CRUD |
| `/api/chat/feedback` | POST | 反馈 |
| `/api/chat/sessions` | GET | 对话历史 |

## 7. 赛事 (可选)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/user/events/list` | GET | 我的赛事列表 |
| `/api/user/events/save` | POST | 收藏/标记赛事 |
| `/api/user/events/delete` | POST | 删除我的赛事 |

## 8. 认证

| 端点 | 说明 |
|------|------|
| `/api/certification/refresh` | POST | 刷新 AI 等级认证 |

## 9. 统一约定

- 所有需要鉴权的接口带 `Authorization: Bearer <token>`
- token 存 `localStorage`
- API baseUrl 统一配置，不硬编码
- **upload-local 接口必须带 `openid` 参数**，否则返回 401
- 状态轮询走 Express 桥接 `/api/upload-local/status/{taskId}`，不直连 FastAPI
