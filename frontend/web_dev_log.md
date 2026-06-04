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
