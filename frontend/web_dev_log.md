# Web Dev Log

## 2026-06-04 Club Web Frontend Stub

### 本次前端范围
- 只修改 `ttai-infra/frontend` 内静态 Web 文件。
- 将现有 `training-enroll.html` 升级为“俱乐部”公开入口，保持现有 Web UI 风格。
- 新增 `club-admin.html` / `club-admin.js` 作为俱乐部管理后台前端预览。
- 新增 `club-data.js` 作为 mock/stub 数据层；当前俱乐部公开页、详情页、管理后台均不依赖真实新增后端接口。
- 线索表单当前只做前端假提交，不写入线上系统。
- 管理后台默认不展示数据；访问 `club-admin.html?preview=1` 才展示 mock 预览数据。

### 待后端确认接口
- `GET /api/clubs/list`
  - 参数：`city`, `district`, `tag`, `page`, `pageSize`
  - 返回：俱乐部列表、合作标识、图片、标签、联系方式、地址、经纬度。
- `GET /api/clubs/detail`
  - 参数：`id` 或 `slug`
  - 返回：俱乐部详情、课程、教练、展示案例。
- `POST /api/clubs/:id/leads`
  - 请求：姓名、手机号、训练目标、来源页面、utm/邀请码。
  - 返回：线索 id、状态。
- `GET /api/club-admin/overview`
  - 返回：会员数、本周活跃、本月 AI 分析次数、新增线索、更新时间。
- `GET /api/club-admin/members`
  - 返回：本俱乐部会员列表、授权状态、最近训练、分析次数、弱项摘要、评分。
- `GET /api/club-admin/leads`
  - 返回：线索列表、来源、状态、创建时间。
- `POST /api/club-admin/leads/:id/status`
  - 请求：线索状态 `new/contacted/visited/enrolled/lost`。
- `GET /api/club-admin/members/:id/activity`
  - 返回：单会员训练日志和 AI 分析摘要。

### 待后端确认权限
- 俱乐部管理员身份来源：建议在登录态用户里返回 `roles` 或新增 club admin profile 接口。
- 管理员与俱乐部绑定：一个管理员可管理一个或多个俱乐部。
- 普通用户默认不能进入 `club-admin.html` 的真实数据态。
- 俱乐部管理员只能访问所属俱乐部的数据。
- 用户训练日志和 AI 分析摘要必须基于用户授权后展示。
- 视频原文件、下载链接、私密训练日志默认不开放给俱乐部管理员，除非用户明确授权。

### 后续接入原则
- 先把 `club-data.js` 替换成 API adapter，页面结构尽量不动。
- 接真实接口前，管理后台必须使用后端权限校验结果，不能只依赖前端 localStorage。
- 接线索提交前，需要明确手机号脱敏、重复线索合并、来源归因和删除策略。

## 2026-06-04 Club Web API Adapter

### 本次前端范围
- `club-data.js` 已从纯 mock 数据层升级为 API adapter + mock fallback。
- 俱乐部列表优先调用 `GET /api/clubs/list`，失败时回退本地 mock。
- 俱乐部详情优先调用 `GET /api/clubs/detail`，失败时回退本地 mock。
- 咨询表单优先调用 `POST /api/clubs/:id/leads`，失败时回退前端预览提交。
- 管理后台优先调用 `/api/club-admin/overview`、`/api/club-admin/members`、`/api/club-admin/leads`，失败时回退 mock。
- 页面会区分数据来源：线上数据、后端接口桩、前端预览数据。

### 当前仍未接真实能力
- 后端返回 `stub: true` 时，管理后台仍视为接口桩，不展示为真实运营数据。
- 俱乐部管理员真实权限、会员授权、线索持久化仍待后端实现。
- 当前 Web 仍保留 `clubAdminPreview` 预览开关，仅用于页面验收；接真实权限后应移除或只保留开发环境使用。

## 2026-06-05 Club Web Real API Contract

### 本次前端范围
- `club-data.js` 已改为真实 API client，不再对线上接口失败自动回退 mock 数据。
- 公开俱乐部列表和详情页只展示后端真实返回；接口失败展示错误/空态。
- 详情页支持普通登录用户授权/取消授权俱乐部查看训练摘要。
- 咨询线索提交只走真实 `POST /api/clubs/:id/leads`；失败不做前端假成功。
- 管理后台先调用 `GET /api/club-admin/profile` 校验真实管理员权限。
- 管理后台支持一个管理员绑定多个俱乐部，通过 `clubId` 切换数据上下文。
- 管理后台会员详情只在会员授权后请求训练日志和 AI 分析摘要。
- 管理后台线索支持状态流转，调用真实状态更新接口。
- `clubAdminPreview` 线上预览入口已移除；仅保留 `club-data.js` 的本地 preview 开关给开发环境使用。

### 普通用户接口契约
- `GET /api/web/me`
  - Header: `Authorization: Bearer <token>`
  - 返回登录用户基础信息与角色。
  - 建议返回：
    ```json
    {
      "loggedIn": true,
      "user": { "openid": "xxx", "nickname": "张同学", "avatar": "", "roles": ["user"] },
      "clubAdmin": { "isAdmin": false, "clubs": [], "defaultClubId": "" }
    }
    ```
- `GET /api/clubs/my-authorizations`
  - 返回当前用户已授权俱乐部列表。
- `POST /api/clubs/:id/authorize`
  - 请求：`{ "scopes": ["training_summary", "analysis_summary"] }`
  - 语义：允许该俱乐部查看训练摘要和 AI 分析摘要，不包含视频原文件。
- `DELETE /api/clubs/:id/authorize`
  - 语义：取消授权。

### 公开俱乐部接口契约
- `GET /api/clubs/list?city=&district=&tag=&page=&pageSize=`
  - 返回：`{ "items": [], "total": 0, "districts": [] }`
- `GET /api/clubs/detail?id=`
  - 返回俱乐部详情；允许 `{ "club": {...} }` 或直接返回俱乐部对象。
- `POST /api/clubs/:id/leads`
  - 匿名和登录用户均可提交；登录用户由后端绑定 openid。
  - 后端负责手机号去重、脱敏、持久化。
  - 管理后台只展示 `phoneMasked`。

### 俱乐部管理员接口契约
- `GET /api/club-admin/profile`
  - 返回管理员身份和绑定俱乐部：
    ```json
    {
      "admin": { "name": "王教练", "role": "owner" },
      "clubAdmin": {
        "isAdmin": true,
        "clubs": [{ "id": "club_001", "name": "徐汇精英乒乓俱乐部", "role": "owner" }],
        "defaultClubId": "club_001"
      }
    }
    ```
- `GET /api/club-admin/overview?clubId=`
  - 返回会员数、本周活跃、本月 AI 分析、新增线索、线索漏斗、弱项统计、训练动态。
- `GET /api/club-admin/members?clubId=`
  - 返回会员摘要列表，必须包含 `authorized`。
- `GET /api/club-admin/members/:id/activity?clubId=`
  - 仅会员授权后返回训练日志和 AI 分析摘要；未授权返回 403 或 `authorized:false`。
- `GET /api/club-admin/leads?clubId=`
  - 返回脱敏线索列表。
- `POST /api/club-admin/leads/:id/status`
  - 请求：`{ "clubId": "club_001", "status": "contacted" }`
  - 状态：`new/contacted/visited/enrolled/lost`。

### 建议数据库改动
- `users`: 新增可选 `roles`、`clubAdmin.clubIds`、`clubAdmin.defaultClubId`、`clubAdmin.roleByClub`。
- 新增 `clubs` 集合：公开俱乐部资料、课程、教练、展示案例。
- 新增 `club_leads` 集合：`clubId/openid/name/phoneHash/phoneMasked/target/source/status/createdAt/updatedAt`。
- 新增 `club_member_authorizations` 集合：`clubId/openid/status/scopes/createdAt/revokedAt/updatedAt`，建议 `{ clubId, openid }` 唯一索引。
- 读取现有 `videos`、`training_logs`、`users` 只做摘要聚合，不写入 clubId，不开放视频原文件 URL。

### 对现有功能的影响控制
- 不改视频分析、视频库、quota、membership 的现有字段语义。
- 不改 openid+md5+mode 唯一逻辑。
- 所有俱乐部能力通过新增集合和新增接口完成。
- 后端如果仍返回 `stub: true`，前端会视为不可用，不展示为真实运营数据。
