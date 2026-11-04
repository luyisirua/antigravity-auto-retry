# Simple AGQ — Antigravity Quota Monitor & Auto Retry

[中文说明](#-中文说明) | [English Documentation](#-english-documentation)

---

## 🇨🇳 中文说明

> **Simple AGQ** 是一款专为 [Antigravity IDE](https://antigravity.dev) 打造的轻量级扩展插件。支持**模型配额实时监控**与 Agent 遇到报错/高负载时的**智能自动重试 (Auto Retry)**，无需人工守候，告别手动频繁点击重试。

**已针对 Windows、macOS (Apple Silicon M1-M4 / Intel) 及 Linux 进行全面兼容与优化。**

---

### ✨ 核心功能

#### 📊 1. 实时模型配额监控 (Quota Monitor)
- **多模型支持**：实时监控所有可用 AI 模型（Gemini 4 Argon, Claude, GPT-OSS 等）的额度使用情况。
- **状态可视化**：直观的颜色标识 —— 🟢 充足、🟡 偏低 (<20%)、🔴 耗尽。
- **精确倒计时**：清晰显示每个模型的配额重置时间（例如 `4h 57m (05:28)`）。
- **状态栏图标**：右下角常驻状态指示灯，点击一键展开侧边栏详情。
- **自动刷新**：支持后台定时自动刷新（默认 120 秒，可自定义）。

#### 🔄 2. 智能自动重试 (Auto Retry)
- **零看护自动化**：当 AI Agent 遇到网络抖动、服务器高负载（High Traffic）或异常中断时，插件会自动检测并触发重试。
- **即时毫秒响应**：采用 `MutationObserver` 深度监听 DOM 变化，重试按钮出现瞬间立即响应，并辅以 10 秒慢轮询兜底。
- **无感瞬时注入 (Fire-and-Forget)**：通过 Chrome DevTools 协议 (CDP) 注入监听脚本后立即断开连接，无需常驻 WebSocket，避免 Electron 窗口抢占焦点。
- **安全防误触机制**：
  - 增加 `document.hasFocus()` 焦点检查，绝不触发后台非活跃标签页。
  - 精确匹配按钮文本（严格匹配 `"Retry"`、`"Try Again"`、`"Resume"`），避免页面其他按钮误触。
  - 自动新标签轮询（每 30 秒自动适配新开启的 Agent 对话窗口）。

#### 🚀 3. 一键调试模式 (Debug Mode)
- Auto Retry 功能依赖 Chromium 调试端口（CDP: 9222）。
- 插件提供一键重启至调试模式功能，也可以通过快捷方式启动参数永久开启。

#### 🛠️ 4. Windows 深度修复 (v1.2.5 独创)
- 修复了原版将进程硬编码为 `language_server_windows_x64.exe` 导致的 `Cannot connect to Antigravity` 报错。
- 完美适配最新 Antigravity 的 `language_server.exe`，开箱即用。

---

### 📦 安装指南

1. 在仓库的 [Releases](../../releases) 页面下载最新的安装包 `simple-agq-1.2.5.vsix`。
2. 打开 Antigravity IDE。
3. 按下快捷键 <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>（macOS 用户按 <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>）。
4. 输入并选择 **`Extensions: Install from VSIX...`**（从 VSIX 安装...）。
5. 选择下载的 `.vsix` 文件完成安装，重载窗口即可生效。

---

### 🔧 使用说明

#### 配额监控
插件安装后会自动激活。点击左侧活动栏的 **🚀 AGQ** 图标，或点击右下角状态栏图标即可查看配额详情。

#### 启用自动重试 (Auto Retry)
自动重试功能需要 Antigravity 开启调试端口（端口号：9222）：

* **方式一（快捷方式永久生效 - 推荐）**：
  * 右键 Antigravity 的桌面或任务栏快捷方式 -> **属性**。
  * 在“**目标 (Target)**”路径末尾添加空格和参数：
    ```text
    --remote-debugging-port=9222
    ```
  * 保存后重新打开 IDE，侧栏直接勾选开启 **Auto Retry** 即可。
* **方式二（插件内一键重启）**：
  * 打开 AGQ 侧边栏，点击 **Restart with Debug Mode** 按钮。
  * IDE 重启完毕后，开启 Auto Retry 开关。

---

### ⚙️ 配置项 (Settings)

| 配置项 | 默认值 | 说明 |
| :--- | :---: | :--- |
| `simpleAgq.autoRefreshInterval` | `120` | 配额自动刷新间隔（单位：秒，最小 30 秒） |
| `simpleAgq.showInStatusBar` | `true` | 是否在底部状态栏显示 AGQ 指示器 |
| `simpleAgq.autoRetryEnabled` | `false` | 是否开启自动重试（可在侧边栏随时切换） |

---

### 🔒 隐私与安全性

- **100% 本地运行**：所有请求仅与本地 `127.0.0.1` 语言服务和调试端口通信，无任何外部服务器连接。
- **零追踪**：无遥测（Telemetry）、无统计、无任何用户数据收集。
- **完全开源**：透明代码审计，无混淆打包，代码位于仓库 `extension/` 目录中。

---

<br/>

## 🇬🇧 English Documentation

> **Simple AGQ** is a lightweight VS Code extension built specifically for [Antigravity IDE](https://antigravity.dev). It monitors AI model quotas in real-time and **automatically retries** when agents encounter rate-limits, high traffic, or runtime errors.

**Fully tested and optimized for Windows, macOS (Apple Silicon M1–M4 & Intel), and Linux.**

---

### ✨ Features

#### 📊 1. Real-time Quota Monitoring
- **Multi-Model Tracking**: View remaining quotas for all AI models (Gemini 4 Argon, Claude, GPT-OSS, etc.).
- **Visual Status**: Color-coded indicators — 🟢 Healthy, 🟡 Low (<20%), 🔴 Exhausted.
- **Countdown Timers**: Accurately shows when quotas reset for each model tier (e.g., `4h 57m (05:28)`).
- **Status Bar Integration**: Unobtrusive status bar indicator with one-click sidebar inspection.
- **Configurable Auto-Refresh**: Background interval polling (default: 120s).

#### 🔄 2. Smart Auto-Retry
- **Zero-Babysitting Automation**: Automatically clicks **"Retry"**, **"Try Again"**, or **"Resume"** when coding agents hit traffic walls or crash.
- **Instant Detection Engine**: Hybrid architecture with `MutationObserver` for sub-second reactive detection + 10s fallback polling.
- **Fire-and-Forget CDP Injection**: Connects via Chrome DevTools Protocol (CDP), injects a self-sustaining observer, and disconnects immediately. No long-lived WebSockets, preventing focus-stealing issues.
- **Safety Guards**:
  - `document.hasFocus()` guard ensures only active, focused windows trigger clicks.
  - Strict exact-match string comparison avoids misclicking unrelated buttons.
  - Periodic polling automatically discovers and injects into newly opened Agent tabs.

#### 🚀 3. One-Click Debug Mode
- Auto Retry requires Chromium remote debugging on port 9222.
- Supports both in-editor restart into debug mode and persistent shortcut flags.

#### 🛠️ 4. Windows Compatibility Fix (v1.2.5)
- Resolves upstream process name mismatch (`language_server.exe` vs `language_server_windows_x64.exe`).
- Fixes the `Cannot connect to Antigravity` error on modern Windows installations.

---

### 📦 Installation

1. Download `simple-agq-1.2.5.vsix` from the [Releases](../../releases) tab.
2. Open Antigravity IDE.
3. Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> (or <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> on macOS).
4. Run the command **`Extensions: Install from VSIX...`**.
5. Select the downloaded `.vsix` file and reload the window.

---

### 🔧 Usage & Setup

#### Quota Monitoring
The extension activates automatically upon startup. Click the **🚀 AGQ** icon in the activity bar or status bar to view usage statistics.

#### Auto Retry Setup
Auto Retry operates via the Chrome DevTools Protocol (CDP: 9222):

* **Method 1 (Permanent Shortcut - Recommended)**:
  * Right-click your Antigravity desktop or taskbar shortcut -> **Properties**.
  * Append `--remote-debugging-port=9222` to the **Target** field (ensure a space precedes the flag):
    ```text
    "C:\...\Antigravity.exe" --remote-debugging-port=9222
    ```
  * Launch via this shortcut and toggle **Auto Retry** ON in the sidebar.
* **Method 2 (In-IDE Restart)**:
  * Click **Restart with Debug Mode** in the AGQ sidebar.
  * Once the IDE restarts, toggle **Auto Retry** ON.

---

### 📋 Architecture

```text
┌────────────────────────────────────────────────────────┐
│ Antigravity IDE (Electron)                             │
│                                                        │
│  ┌─ Extension Host ────────┐   ┌─── UI / Agent DOM ──┐ │
│  │ AGQ Extension           │   │  [Retry] Button 🔘  │ │
│  │ (Quota + Auto-Retry)    │   │  (Chromium Webview) │ │
│  └───────────┬─────────────┘   └──────────▲──────────┘ │
│              │ 1. Connect CDP             │            │
│              │ 2. Inject Observer Script  │            │
│              │ 3. Disconnect (Immediate) ─┘            │
│              │    (Fire-and-forget)                    │
│              └──── CDP : 9222 ─────────────────────────┘
└────────────────────────────────────────────────────────┘
```

---

### 📝 Changelog

#### v1.2.5
- **Fixed:** Resolved language server process detection failure on Windows (`language_server.exe` support for modern Antigravity releases).
- **Fixed:** Eliminated `Cannot connect to Antigravity` error on Windows.
- **Improved:** Included full unpacked source code under `extension/` directory for transparent open-source review.
- **Docs:** Added comprehensive bilingual (Chinese / English) documentation.

#### v1.2.4
- **Fixed:** Improved Windows restart scripts.

#### v1.2.3
- **Fixed:** Prevented background tabs from stealing focus.
- **Architecture:** Fire-and-forget CDP injection (stateless WebSocket).
- **Performance:** Hybrid `MutationObserver` + fallback timer.
- **Security:** CSP enforcement and input sanitization.

#### v1.2.2
- **Fixed:** Target discovery polling when enabling Auto Retry during startup.

#### v1.2.1
- **Feature:** Initial Auto Retry implementation with Debug Mode support.

#### v1.0.0
- **Feature:** Real-time quota monitoring and status bar indicator.

---

### 📄 License

[MIT License](LICENSE)
