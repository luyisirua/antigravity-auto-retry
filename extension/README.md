# Simple AGQ - Antigravity Quota Extension

Extension VS Code đơn giản để xem quota của các AI models trong Antigravity IDE.

## Features

- 🚀 Hiển thị quota trên status bar
- 📊 Menu chi tiết với progress bar cho từng model
- 🔄 Auto refresh theo interval
- ⚠️ Cảnh báo khi quota thấp hoặc hết

## Usage

1. Cài extension
2. Click vào icon `AGQ` trên status bar
3. Xem quota của từng model
4. Click "Refresh Now" để cập nhật

## Commands

- `AGQ: Refresh Quota` - Refresh quota ngay lập tức
- `AGQ: Show Quota Details` - Mở menu chi tiết

## Settings

- `simpleAgq.autoRefreshInterval`: Interval tự động refresh (mặc định 120s, tối thiểu 30s)
- `simpleAgq.showInStatusBar`: Hiển thị trên status bar (mặc định true)

## Build

```bash
yarn install
yarn compile
yarn package
```

## Install từ VSIX

```bash
code --install-extension simple-agq-1.0.0.vsix
```
