# 线上信邮与藏邮

前端发布于 https://emanon4.github.io/Typer/ ，邮局 API 为 https://typer-post.moji-pet.workers.dev 。Cloudflare 的设备登录解决了本地 OAuth 回调过期造成的失败；D1 已创建并应用首个数据库迁移。

## 信邮

`server/post-service.mjs` 是本地与线上共用的业务逻辑。`server/post-office.mjs` 使用本地 SQLite；`post-worker/index.js` 使用 D1 的异步预编译查询。注册、密码登录、延迟投递、拉黑、每日限额和信件快照由后端执行。

跨站点会话通过 Authorization 头发送，保存在 Pages 页面的 sessionStorage 中。Safari 无需第三方 Cookie；同一标签页刷新保持登录，关闭会话后重新登录。服务端只保留令牌哈希，退出会撤销令牌。密码使用 scrypt 加盐派生。前端构建只包含公开的 API 地址。

默认每天可成功投邮三封，收信人最低等待二十四小时；两者可在设置中修改。相同 nonce 并发重试只存入一封信，限额与插入在单条 SQL 中判断。未到投递时间的信件无法提前查看。账号互寄限于 Typer 邮址。

首次部署：

```sh
npx wrangler d1 migrations apply typer-post --remote --config post-worker/wrangler.jsonc
npx wrangler deploy --dry-run --config post-worker/wrangler.jsonc
npx wrangler deploy --config post-worker/wrangler.jsonc
```

线上验收使用独立测试账号，不操作真实用户信件：

```sh
POST_TEST_BASE=https://typer-post.moji-pet.workers.dev node scripts/verify-post-live.mjs
POST_TEST_BASE=https://typer-post.moji-pet.workers.dev node scripts/verify-post-live.mjs --resume
```

测试账号凭据只写入 Git 忽略的 `output/post-online-2026-09-22/*-accounts.private.json`，权限 0600。可公开的报告只记录检查名与执行时间。

## 邮票与明信片

十二枚邮票来自同一个 `src/stamps.js` 目录，集邮册与贴邮票共用。收藏与下一封信的选票保存在本机。图案是 Typer 原创艺术，不标注真实邮政发行年份、票值或稀缺性。

稿纸箱保留原五种纸，增加六张 148:105 双面明信片。插画面独立于背面的纸纹与墨迹；文字仍由共享机械坐标系排版。切换成不同形状前保存当前稿件，私密信笺只保存到所属账号的草稿。后端从纸品目录推导明信片容量，不接受客户端伪造的大幅面。导出 ZIP 内包含 2480 × 1759 的插画面和文字面。

实体键帽上增加与机型几何一致的鼠标点击区域，按下即改变独立键帽的位移并进入共用击打队列，松开不会重复落字。Shift 采用一次换挡，空格移动字车。没有移动机身大小或改变字杆、压纸尺的间距。

素材及生成提示见 [藏邮素材说明](postal-art-2026-09-22.md)。

## 验证记录

- 59 项本地测试通过，覆盖原有 IME、字杆、全部机型按键间距及新增明信片容量、击纸位置和服务端快照验证。
- 线上 Workers + D1 通过 30 项 HTTP 验收，包含并发重试与限额、提前读取限制、账号隔离、新邮票与明信片投递。重新部署后的原测试账号可以登录，原信件仍在。
- Safari 已实测集邮册收藏、选票、鼠标单次落字及 Shift 大写；系统拼音输入法提交「你好」只印一次。明信片换纸前原稿收入文稿箱，退纸后可以翻转查看插画面。
- Safari 实际导出的 ZIP 包含两张 2480 × 1759 PNG，已解包检查尺寸并查看文字面，保留纸纤维和同一份字迹。
- `npm run build`、`npm run test:sites`、`npm run build:pages` 通过；受保护的 Sites 文件未改动。
