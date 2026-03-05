MiniIDE

MiniIDE 是一个轻量级的 JavaScript 编辑器和运行环境，基于 Electron 开发，专为 Windows 用户设计。它界面简洁、启动快速，适合学生、开发者或初学者进行轻量编程。

功能特点

支持 JavaScript 代码编辑与运行

内置控制台输出，方便查看程序结果

编辑区与小地图同步滚动，提高编辑效率

可自定义主题和字体大小

轻量快速，适合学习和小型项目开发

安装与运行

用户可以直接从 GitHub 下载 MiniIDE 的 Windows 可执行文件，解压后双击即可启动，无需额外安装。

对于开发者，可以下载源代码，并使用 Node.js 安装依赖后运行。运行环境基于 Electron，提供完整的代码编辑和执行功能。

打包与发布

MiniIDE 使用 electron-builder 打包为 Windows 可执行文件。打包后的文件可以直接上传到 GitHub Release 或其他渠道。

如果没有 Windows 签名证书，打包程序仍然可以运行，但首次启动时可能会被 Windows 弹窗提示安全警告，这是正常现象。

使用建议

建议在 Windows 10 或以上版本运行

编辑 JavaScript 文件时可自由调整字体大小和主题

对于初学者，可以通过内置控制台快速测试代码
