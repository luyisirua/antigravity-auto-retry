# Hướng Dẫn Tạo VSCode Extension với TypeScript

## 📋 Tổng Quan

VSCode Extension là một plugin mở rộng chức năng cho Visual Studio Code. Extension của bạn (`simple-agq`) là một ví dụ tuyệt vời về cấu trúc cơ bản.

## 🏗️ Cấu Trúc Thư Mục Cơ Bản

```
agq-extension/
├── src/                      # Source code TypeScript
│   ├── extension.ts          # Entry point chính
│   ├── types.ts              # Type definitions
│   ├── sidebar_provider.ts   # Webview provider
│   ├── quota_service.ts      # Business logic
│   └── process_finder.ts     # Utility functions
├── out/                      # Compiled JavaScript (generated)
├── node_modules/             # Dependencies
├── package.json              # Manifest & metadata
├── tsconfig.json             # TypeScript config
├── .vscodeignore             # Files to exclude from package
└── README.md                 # Documentation
```

## 📦 File Quan Trọng

### 1. `package.json` - Manifest File

Đây là file **QUAN TRỌNG NHẤT**, định nghĩa metadata và capabilities của extension:

```json
{
  "name": "simple-agq",
  "displayName": "Simple AGQ - Antigravity Quota",
  "description": "Mô tả extension",
  "version": "1.1.0",
  "publisher": "local",
  "engines": {
    "vscode": "^1.85.0" // VSCode version tối thiểu
  },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"], // Khi nào extension được kích hoạt
  "main": "./out/extension.js", // Entry point sau khi compile

  "contributes": {
    // Đăng ký UI components, commands, settings...
  },

  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "package": "vsce package --no-dependencies"
  },

  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0", // Type definitions cho VSCode API
    "@vscode/vsce": "^3.0.0", // Tool để package extension
    "typescript": "^5.3.0"
  }
}
```

#### Các Phần Quan Trọng trong `contributes`:

**a) Commands** - Đăng ký các lệnh:

```json
"commands": [
  {
    "command": "simpleAgq.refresh",
    "title": "AGQ: Refresh Quota",
    "icon": "$(refresh)"
  }
]
```

**b) Views & ViewContainers** - Tạo sidebar/panel:

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "agq-sidebar",
      "title": "AGQ Quota",
      "icon": "$(rocket)"
    }
  ]
},
"views": {
  "agq-sidebar": [
    {
      "type": "webview",
      "id": "agq.quotaView",
      "name": "Model Quotas"
    }
  ]
}
```

**c) Configuration** - Settings cho user:

```json
"configuration": {
  "title": "Simple AGQ",
  "properties": {
    "simpleAgq.autoRefreshInterval": {
      "type": "number",
      "default": 120,
      "description": "Auto refresh interval in seconds"
    }
  }
}
```

### 2. `tsconfig.json` - TypeScript Configuration

```json
{
  "compilerOptions": {
    "module": "commonjs", // VSCode sử dụng CommonJS
    "target": "ES2020", // Target JavaScript version
    "lib": ["ES2020"],
    "outDir": "out", // Output directory
    "rootDir": "src", // Source directory
    "strict": true, // Strict type checking
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true // Để debug
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out"]
}
```

### 3. `src/extension.ts` - Entry Point

File này **BẮT BUỘC** phải export 2 functions:

```typescript
import * as vscode from "vscode";

// Được gọi khi extension được activate
export async function activate(context: vscode.ExtensionContext) {
  console.log("Extension is now active!");

  // 1. Đăng ký commands
  const disposable = vscode.commands.registerCommand("extension.hello", () => {
    vscode.window.showInformationMessage("Hello World!");
  });

  // 2. Add vào subscriptions để cleanup khi deactivate
  context.subscriptions.push(disposable);

  // 3. Tạo status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(rocket) My Extension";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

// Được gọi khi extension được deactivate
export function deactivate() {
  // Cleanup resources
}
```

### 4. `.vscodeignore` - Exclude Files

Các file không cần thiết khi package:

```
.vscode/**
.vscode-test/**
src/**
.gitignore
tsconfig.json
**/*.map
**/*.ts
!out/**/*.js
node_modules/**
```

## 🔧 Thư Viện & Dependencies Cần Thiết

### Dependencies Bắt Buộc (devDependencies):

```bash
yarn add -D @types/vscode @types/node typescript @vscode/vsce
```

- **`@types/vscode`**: Type definitions cho VSCode API
- **`@types/node`**: Type definitions cho Node.js
- **`typescript`**: TypeScript compiler
- **`@vscode/vsce`**: Visual Studio Code Extension Manager (để package)

### VSCode API Thường Dùng:

```typescript
import * as vscode from "vscode";

// 1. Window API - Tương tác với UI
vscode.window.showInformationMessage("Hello!");
vscode.window.showErrorMessage("Error!");
vscode.window.showWarningMessage("Warning!");
vscode.window.createStatusBarItem();
vscode.window.createOutputChannel("My Channel");

// 2. Commands API - Đăng ký & thực thi commands
vscode.commands.registerCommand("myext.command", () => {});
vscode.commands.executeCommand("workbench.action.files.save");

// 3. Workspace API - Làm việc với workspace
vscode.workspace.getConfiguration("myext");
vscode.workspace.workspaceFolders;
vscode.workspace.onDidChangeConfiguration();

// 4. TextEditor API - Làm việc với code
const editor = vscode.window.activeTextEditor;
editor?.document.getText();
editor?.edit((editBuilder) => {
  editBuilder.insert(new vscode.Position(0, 0), "text");
});

// 5. FileSystem API
vscode.workspace.fs.readFile(uri);
vscode.workspace.fs.writeFile(uri, content);
```

## 🎨 Các Pattern Phổ Biến

### 1. Webview Provider (như `sidebar_provider.ts`)

```typescript
export class MyWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "myext.view";
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent();

    // Nhận message từ webview
    webviewView.webview.onDidReceiveMessage((data) => {
      if (data.type === "action") {
        // Handle action
      }
    });
  }

  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
    <html>
      <head>
        <style>
          body { 
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
          }
        </style>
      </head>
      <body>
        <h1>Hello from Webview</h1>
        <button onclick="sendMessage()">Click me</button>
        <script>
          const vscode = acquireVsCodeApi();
          function sendMessage() {
            vscode.postMessage({ type: 'action' });
          }
        </script>
      </body>
    </html>`;
  }
}
```

### 2. Configuration Management

```typescript
// Đọc config
const config = vscode.workspace.getConfiguration("myext");
const value = config.get<number>("setting", 100);

// Lắng nghe thay đổi
vscode.workspace.onDidChangeConfiguration((e) => {
  if (e.affectsConfiguration("myext.setting")) {
    // Handle change
  }
});

// Update config
config.update("setting", newValue, vscode.ConfigurationTarget.Global);
```

### 3. Status Bar Item

```typescript
const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100 // Priority
);

statusBarItem.text = "$(rocket) My Status";
statusBarItem.tooltip = "Click me!";
statusBarItem.command = "myext.command";
statusBarItem.backgroundColor = new vscode.ThemeColor(
  "statusBarItem.errorBackground"
);
statusBarItem.show();
```

## 🔨 Build & Package

### 1. Development

```bash
# Install dependencies
yarn install

# Compile TypeScript
yarn compile

# Watch mode (auto-compile khi file thay đổi)
yarn watch
```

### 2. Testing trong VSCode

Nhấn **F5** trong VSCode để mở Extension Development Host window.

### 3. Package Extension

```bash
# Tạo .vsix file
yarn package
# hoặc
vsce package --no-dependencies

# Kết quả: simple-agq-1.1.0.vsix
```

### 4. Install Extension

```bash
# Install từ .vsix file
code --install-extension simple-agq-1.1.0.vsix

# Hoặc trong VSCode:
# Extensions view → ... menu → Install from VSIX
```

### 5. Publish (nếu muốn public)

```bash
# Tạo Personal Access Token từ Azure DevOps
# https://dev.azure.com/

# Login
vsce login <publisher-name>

# Publish
vsce publish
```

## 📚 Thư Viện Bổ Sung Hữu Ích

### 1. Axios - HTTP requests

```bash
yarn add axios
yarn add -D @types/axios
```

### 2. Lodash - Utility functions

```bash
yarn add lodash
yarn add -D @types/lodash
```

### 3. Moment/Day.js - Date handling

```bash
yarn add dayjs
```

### 4. Node-fetch - Fetch API

```bash
yarn add node-fetch
yarn add -D @types/node-fetch
```

## 🎯 Best Practices

### 1. Activation Events

Chọn activation event phù hợp để không làm chậm VSCode:

```json
"activationEvents": [
  "onStartupFinished",        // Sau khi VSCode khởi động xong
  "onCommand:myext.command",  // Khi command được gọi
  "onLanguage:javascript",    // Khi mở file JS
  "onView:myext.view",        // Khi view được mở
  "workspaceContains:**/*.js" // Khi workspace có file JS
]
```

### 2. Dispose Resources

Luôn cleanup resources:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(...);

  // Add vào subscriptions
  context.subscriptions.push(disposable);

  // Hoặc tự dispose
  const timer = setInterval(() => {}, 1000);
  context.subscriptions.push({
    dispose: () => clearInterval(timer)
  });
}
```

### 3. Error Handling

```typescript
try {
  // Your code
} catch (error) {
  vscode.window.showErrorMessage(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
}
```

### 4. Use Output Channel cho Logging

```typescript
const outputChannel = vscode.window.createOutputChannel("My Extension");
outputChannel.appendLine("Log message");
outputChannel.show(); // Show the output panel
```

## 🔍 Debugging

### `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

## 📖 Tài Liệu Tham Khảo

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [VSCode Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## 💡 Ví Dụ Extension Của Bạn

Extension `simple-agq` của bạn đã implement:

✅ **Webview Provider** - Sidebar với HTML/CSS custom
✅ **Status Bar Item** - Hiển thị status với icon động
✅ **Commands** - Refresh và show quota
✅ **Configuration** - Settings cho auto-refresh interval
✅ **Auto-refresh** - Timer với cleanup proper
✅ **Service Pattern** - Tách business logic ra `quota_service.ts`
✅ **Type Safety** - Sử dụng TypeScript interfaces

Đây là một cấu trúc rất tốt cho một internal extension! 🎉
