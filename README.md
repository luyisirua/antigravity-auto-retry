# antigravity-auto-retry

Fork 自 [quitam/antigravity-auto-retry](https://github.com/quitam/antigravity-auto-retry)，针对 Windows 环境和 Antigravity 2.0 做了一些适配和补充。

## 内容说明

仓库包含两部分：

1. **VS Code 扩展（`extension/`、`simple-agq-1.2.5.vsix`）**
   - 适用于 Antigravity IDE（通过 `Open IDE` 打开的编辑器界面）。
   - 修复了原版在 Windows 下查找 `language_server_windows_x64.exe` 导致无法读取配额的问题，兼容 `language_server.exe`。
   - 将 Auto Retry 开关移到了侧边栏顶部，并在状态栏增加了快捷开关。

2. **独立客户端脚本（适用于 Antigravity 2.0）**
   - Antigravity 2.0 主界面不加载 `.vsix` 扩展，且 2.33.0 起屏蔽了 9222 调试端口。
   - `AntigravityAutoRetry.ps1` / `Start-AutoRetry.vbs`：基于 Windows UI Automation 定时检测 `Retry` / `Try again` / `Resume` / `重试` 按钮并自动点击，带系统托盘开关。
   - `ag2-auto-retry.js`：通过 CDP 9222 端口注入悬浮开关按钮的脚本，仅适用于未屏蔽 `--remote-debugging-port=9222` 的旧版本。

## 使用方法

### VS Code 扩展（IDE 模式）

1. 下载 `simple-agq-1.2.5.vsix`。
2. 在 IDE 中按 `Ctrl + Shift + P`，执行 `Extensions: Install from VSIX...` 选择该文件安装。
3. 使用 Auto Retry 需要在启动参数加上 `--remote-debugging-port=9222`。

### 桌面托盘脚本（Antigravity 2.0）

1. 双击 `Start-AutoRetry.vbs` 启动（托盘绿色图标为开启，灰色为暂停，左键点击切换）。
2. 如果右键“诊断控件识别”提示按钮数为 0，可在 Antigravity 快捷方式目标末尾加上空格和 `--force-renderer-accessibility`，重启客户端后再试。

## License

MIT
