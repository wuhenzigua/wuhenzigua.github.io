# VPS 自动部署

`master` 更新或手动运行 GitHub Actions 的 **Deploy blog to VPS** 后，工作流打包静态文件，通过受限 SSH 命令发布到 `104.223.50.104`。工作流不运行 Hexo；仓库已包含生成后的网页。

## 发布机制

- 专用账号 `blog-deploy` 无 sudo 权限；SSH 密钥只能执行 `/usr/local/libexec/blog-receive.py`，不能打开 shell、转发端口或运行任意远程命令。
- 发布到 `/var/www/main-site/releases/<commit>-<随机后缀>`，校验后原子切换 `/var/www/main-site/current`。
- 原站 HTTPS 校验失败时自动恢复上一版。旧发布目录保留，不自动删除。
- GitHub Secrets：`BLOG_DEPLOY_KEY`、`BLOG_KNOWN_HOSTS`。禁止将私钥提交到仓库。
- SSH 主机密钥固定校验；公开网址通过 `deployment-version.txt` 校验上线提交。
- 排除隐藏文件、`deploy/`、CNAME 和维护文档；拒绝符号链接。
- 游戏站点和独立 TED 服务不受影响。

## 日常使用

让 Claude 修改本仓库并 push 到 master，然后查看 Actions。通过分支提交 PR 时，合并 master 才部署。可本地执行 `python3 -m http.server 8000` 预览。

## 回滚与维护

最简单的回滚方式是 `git revert <错误提交>` 并 push，让工作流重新发布。紧急情况下管理员可将 `current` 符号链接原子替换为上一发布目录。

`receive.py` 是服务器受限接收脚本的备份，工作流不会自动安装它。修改它需要管理员审核并通过独立管理连接更新 `/usr/local/libexec/blog-receive.py`。服务器证书由已有 Certbot 任务自动续期。
