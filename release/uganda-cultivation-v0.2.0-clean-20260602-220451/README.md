# 乌干达修仙 v0.2.0

## 静态网页

`web-dist` 是网页前端发布目录。

## 账号与排行榜服务

真实账号登录和实时排行榜需要运行 Python 服务：

```powershell
python server/app.py 4173
```

服务默认从 `web-dist` 提供前端页面，并在 `tmp/server-data/uganda.sqlite3` 保存账号、密码哈希、登录会话和排行榜。

正式公网部署时：

1. 使用 HTTPS。
2. 将 `server/app.py` 放到进程守护服务后运行。
3. 使用反向代理提供域名。
4. 将排行榜积分结算迁移到服务端战斗校验，避免客户端修改积分。
