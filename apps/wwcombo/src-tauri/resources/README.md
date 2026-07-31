# FFmpeg 打包资源

默认的 Tauri 构建不捆绑 FFmpeg，训练器会继续从应用目录或系统 PATH 查找 ffmpeg。

需要生成包含视频导出能力的完整安装包时：

1. 将可分发的 64 位 ffmpeg.exe 放在本目录。
2. 从仓库根目录运行 corepack pnpm run trainer:desktop:build:full。

ffmpeg.exe 已在根目录 .gitignore 中忽略，不应作为项目源码提交。分发时请同时遵守所选 FFmpeg 构建及其编解码组件的许可证。
