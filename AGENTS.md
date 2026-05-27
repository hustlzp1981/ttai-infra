# AGENTS.md — TT.AI 后端

## 项目概述
乒乓球AI训练和比赛分析后端服务。提供视频上传/处理（YOLOv8姿态识别、回合剪辑）、微信登录、AI技术问答等能力。
- **生产**: www.ttcut.com (阿里云 nginx → 本后端)
- **前端代码**: Windows miniprogram-ttai/ (通过 SSH 也可操作)

## 技术栈
| 后端 | 基础设施 |
|------|---------|
| Python 3.12 + FastAPI (:5000) | Docker Compose |
| Node.js + Express (:3000) | MongoDB 6.0 |
| Celery (GPU + Video Workers) | Redis 7 |
| YOLOv8-pose ONNX (GPU 推理) | Nginx (反向代理) |
| ffmpeg + NVENC 硬件编码 | Celery Flower (:5555) |

## 目录结构
`
~/workspace/tt.ai/
├── app/
│   ├── main.py              ← FastAPI 入口 (所有路由)
│   ├── models/              ← YOLO / 姿态 / 球检测 / 视频编辑
│   ├── tasks/               ← Celery 任务 (合并/推理/分析)
│   └── utils/               ← Redis / 文件工具
├── wechat-backend/          ← Express (登录 + WebSocket AI)
│   └── src/
│       ├── server.js        ← 主入口 + WebSocket
│       ├── login.js         ← 微信登录 API
│       ├── tech.js          ← AI 问答 (WebSocket 流式)
│       ├── user.js          ← 用户资料
│       └── feedback.js      ← 反馈 API
├── frontend/                ← Web 前端 (Nginx 托管)
├── docker-compose.yml       ← 8 服务编排
├── tests/
│   └── test_regression.py   ← ** 回归测试 (6 条) **
├── docs/
│   ├── api-contract.md      ← API 接口契约
│   └── specs/               ← 设计文档
├── restart.sh               ← 完全重建所有容器
└── .env                     ← 敏感配置
`

## 服务拓扑
`
nginx (:80/:443)
  ├── /upload/*, /status/*, /download/* → backend:5000
  ├── /ws (WebSocket upgrade)           → wechat-login:3000
  └── /api/*                            → wechat-login:3000

Celery Workers:
  gpu_worker (cores 8-15, GPU 0) → YOLO ONNX batch inference
  video_worker (cores 0-7)       → FFmpeg video processing
`

## 常用命令
`ash
# 查看状态
docker-compose ps

# 日志
docker-compose logs -f backend
docker-compose logs -f celery_gpu_worker
docker-compose logs -f celery_video_worker
docker-compose logs -f wechat-login

# 完整重启
bash restart.sh

# 回归测试
docker-compose exec backend pip install pytest -q
docker-compose exec backend pytest tests/test_regression.py -v

# 进入容器
docker-compose exec backend bash
`

## 接口变更规范
| 规则 |
|------|
| 修改/新增 API → 必须同步更新 docs/api-contract.md 和 docs/specs/SPEC-backend-api.md |
| 响应结构变化 → 标注变更原因和时间，加 [BREAKING] 前缀 |
| **新增 API 路径 → 检查 Alibaba Cloud nginx 是否需要增加路由**，并在 STATUS.md「今日动态」中声明 ⚠️ |
| 新增 API → 写清完整请求/响应示例 |
| 前端需要新接口 → 先在 docs/api-contract.md 中写期望的 shape，后端按此实现 |


## 模块归属 (谁改什么，别踩彼此的文件)


| 工程师 | 模块 | 核心文件 |

|--------|------|---------|

| Alice | 赛事 | crawler.js, events.js, competitions.js, pages/discover/, event-detail |

| Jim | AI教练 | tech.js, ask.js, ai-client.js, markdown.js, chat-feedback.js, chat-sessions.js, training-log.js |

| Howie | 视频库/对手 | videos.js, opponents.js, stats.js, pages/opponent/, pages/video-lib/, pages/training-stats/ |

| Jack | 后端基础设施 | server.js, app/main.py, tests/, crawler.js |

| ARCH | 架构/文档 | AGENTS.md, STATUS.md, SPECs, app.json, utils/ |


## 全栈开发闭环 (每次任务必须)

### Step 1: 理解
读 STATUS.md 了解现状 + 「今日动态」确认无冲突，读对应 SPEC 了解设计

### Step 2: 开发 — 冲突检查
- 在 STATUS.md「今日动态」写一行「开始: xxx」，共享模块标 ⚠️
- 如果涉及 server.js/app/main.py/api-contract.md，标注全局影响
- API 变更 → 同步 docs/api-contract.md + docs/specs/SPEC-backend-api.md
- 完成后 commit

### Step 3: Commit 前检查
`ash
git diff --stat           # 确认只改了预期文件
docker-compose exec backend pip install pytest -q
docker-compose exec backend pytest tests/test_regression.py -v
`
- [ ] 如果改了 API → docs/api-contract.md 已同步
- [ ] 如果改了模块完成状态 → STATUS.md 已更新
- [ ] 在 STATUS.md「今日动态」标记完成
`ash
docker-compose exec backend pip install pytest -q
docker-compose exec backend pytest tests/test_regression.py -v
# 预期: 6 passed
`
前端验证 (如涉及页面修改): 微信开发者工具模拟器

### Step 4: 回归测试

`ash

docker-compose exec backend pip install pytest -q

docker-compose exec backend pytest tests/test_regression.py -v

# 期望: 31+ passed

`

前端验证 (如涉及): 微信开发者工具模拟器


### Step 5: 不通过 → 查日志 → 修复 → 回到 Step 4
`ash
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 celery_gpu_worker
docker-compose logs --tail=50 celery_video_worker
docker-compose logs --tail=50 wechat-login
`
| 根因 | 行动 |
|------|------|
| 我改的模块 | 修复 → 为该 bug 增加测试用例到 	ests/test_regression.py → 回到 Step 4 |
| 其他模块 (可能被其他工程师开发中) | 记到 docs/specs/STATUS.md 已知问题区，**不阻塞当前任务** |
| 环境问题 | 重建: ash restart.sh → 回到 Step 4 |

### Step 6: 全绿 → 更新状态
- 更新 docs/specs/STATUS.md 对应模块完成度 → 署上你的工程师名
- 如: ✅ 已上线 (2026-05-17 | Alice)

## 设计文档
开发前先读 spec 了解全貌。
| 文档 | 用途 |
|------|------|
| docs/api-contract.md | API 接口契约 (前后端共享) |
| docs/specs/STATUS.md | 项目状态报告 + MVP 路线图 |
| docs/specs/SPEC-backend-api.md | 全部 API 设计 + 数据模型 |
| docs/specs/SPEC-competition.md | 赛事模块专项 |

## 编码规范
- Python: PEP 8, 4 空格缩进
- Node.js: 单引号, 无分号, 2 空格缩进
- 环境变量: 所有敏感配置从 .env 读取

## 已知问题
1. wx.getUserProfile 已废弃 → 前端登录需迁移
2. POST /ask HTTP fallback 未实现 (仅 WebSocket 方式)
3. celery 任务无取消机制
4. safari 上传时已存在文件不进入分析界面
