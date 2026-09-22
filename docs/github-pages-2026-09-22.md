# GitHub Pages 发布记录

用户已明确授权公开 Emanon4/Typer，并推送本轮全部源码修改。

- 站点：https://emanon4.github.io/Typer/
- 仓库：https://github.com/Emanon4/Typer
- 发布来源：main 分支的 .github/workflows/pages.yml。
- Pages 构建：npm run build:pages，产物 dist/pages，base 为 /Typer/。
- 本机带后端构建：npm run build，产物 dist/client 与 Sites 契约文件，仍保持独立。

本次提交包含机械重构及机型、中文输入和墨迹修正、长卷存档与导出、信邮前端及 SQLite 后端，以及全部相关测试和资产说明。测试数据库、浏览器会话缓存、原始参考视频及重复本地备份不进入公开仓库。可重复运行的测试与精简验收报告一并提交，历史截图工作目录保留在本机。

GitHub Pages 是静态部署，线上提供个人打字与长卷功能。账号互寄后端完整保留在源码里，但不在 Pages 执行；线上信邮入口明确显示尚未开通，不显示无效的注册表单。纸纹、图片和音效均通过统一的站点路径加载。

发布前本机 54 项测试通过，Sites 和 Pages 两种构建均通过。Pages 构建脚本会检查产物内的实际资源路径和文件存在性。云端流水线会再次执行完整测试后才部署。
