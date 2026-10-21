# 东南枝博客

- 线上地址：https://www.dongnanzhi.top/
- 本仓库是已生成的静态网站；直接修改 HTML、CSS、JS 和数据文件即可发布，无需 npm 构建。
- `master` 每次 push 会触发 `.github/workflows/deploy-vps.yml`，自动部署到 VPS。Claude 不需要连接服务器，也不需要服务器密码或部署密钥。
- 修改前先拉取最新 master；完成后检查本地页面、链接及 JS 语法，再提交并推送。需要审阅时先建分支和 PR，合并 master 后才会上线。
- 推送后检查 GitHub Actions 的 “Deploy blog to VPS” 结果，成功后检查线上受影响的页面。
- 保留 `papers/`、`tools/` 和现有文章。`/ted/` 由服务器独立配置提供，不属于本仓库发布目录。
- 部署信息见 `deploy/README.md`。修改网页时通常无需调整部署工作流。
- 长期通过 Hexo 写作时应修改原始源码并重新生成；直接修改生成文件可能在未来重新生成时被覆盖。
