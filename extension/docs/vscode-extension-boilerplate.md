# VSCode Extension Boilerplate - Cấu Trúc Chuẩn

## 🚀 Khởi Tạo Project Mới

### Cách 1: Sử dụng Yeoman Generator (Khuyến nghị)

```bash
# Install Yeoman và VSCode Extension Generator
npm install -g yo generator-code

# Tạo project mới
yo code

# Chọn:
# ? What type of extension do you want to create? New Extension (TypeScript)
# ? What's the name of your extension? my-extension
# ? What's the identifier of your extension? my-extension
# ? What's the description of your extension? My awesome extension
# ? Initialize a git repository? Yes
# ? Which bundler to use? esbuild
# ? Which package manager to use? yarn
```

### Cách 2: Tạo Thủ Công (Hiểu Rõ Hơn)

Tôi sẽ hướng dẫn tạo từng file một bên dưới.

---

## 📁 Cấu Trúc Thư Mục Chuẩn

```
my-extension/
├── .vscode/
│   ├── launch.json           # Debug configuration
│   ├── tasks.json            # Build tasks
│   └── extensions.json       # Recommended extensions
├── src/
│   ├── extension.ts          # Entry point
│   ├── commands/             # Command handlers
│   │   └── helloWorld.ts
│   ├── providers/            # Providers (Webview, TreeView, etc.)
│   │   └── sidebarProvider.ts
│   ├── services/             # Business logic
│   │   └── dataService.ts
│   ├── utils/                # Utilities
│   │   └── logger.ts
│   └── types/                # Type definitions
│       └── index.ts
├── resources/                # Icons, images
│   └── icon.png
├── test/                     # Tests
│   └── suite/
│       └── extension.test.ts
├── out/                      # Compiled output (generated)
├── node_modules/             # Dependencies (generated)
├── .gitignore
├── .vscodeignore
├── .eslintrc.json
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md
└── LICENSE
```

---

## 📄 Các File Cấu Hình

### 1. `package.json` - Chuẩn & Đầy Đủ

```json
{
  "name": "my-extension",
  "displayName": "My Extension",
  "description": "A professional VSCode extension",
  "version": "0.0.1",
  "publisher": "your-publisher-name",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/my-extension"
  },
  "bugs": {
    "url": "https://github.com/yourusername/my-extension/issues"
  },
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "keywords": ["productivity", "tools"],
  "icon": "resources/icon.png",
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "myExtension.helloWorld",
        "title": "Hello World",
        "category": "My Extension"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "myExtension-sidebar",
          "title": "My Extension",
          "icon": "$(rocket)"
        }
      ]
    },
    "views": {
      "myExtension-sidebar": [
        {
          "type": "webview",
          "id": "myExtension.sidebarView",
          "name": "Main View"
        }
      ]
    },
    "configuration": {
      "title": "My Extension",
      "properties": {
        "myExtension.enable": {
          "type": "boolean",
          "default": true,
          "description": "Enable/disable the extension"
        },
        "myExtension.refreshInterval": {
          "type": "number",
          "default": 60,
          "minimum": 10,
          "description": "Auto refresh interval in seconds"
        }
      }
    },
    "keybindings": [
      {
        "command": "myExtension.helloWorld",
        "key": "ctrl+shift+h",
        "mac": "cmd+shift+h"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "yarn run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "yarn run compile && yarn run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js",
    "package": "vsce package --no-dependencies",
    "publish": "vsce publish"
  },
  "devDependencies": {
    "@types/glob": "^8.1.0",
    "@types/mocha": "^10.0.6",
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "@vscode/test-electron": "^2.3.8",
    "@vscode/vsce": "^2.22.0",
    "eslint": "^8.56.0",
    "glob": "^10.3.10",
    "mocha": "^10.2.0",
    "typescript": "^5.3.3"
  },
  "dependencies": {}
}
```

### 2. `tsconfig.json` - TypeScript Config

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "moduleResolution": "node",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", "test"]
}
```

### 3. `.eslintrc.json` - ESLint Config

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/naming-convention": "warn",
    "@typescript-eslint/semi": "warn",
    "curly": "warn",
    "eqeqeq": "warn",
    "no-throw-literal": "warn",
    "semi": "off"
  },
  "ignorePatterns": ["out", "dist", "**/*.d.ts"]
}
```

### 4. `.vscode/launch.json` - Debug Config

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
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
      ],
      "outFiles": ["${workspaceFolder}/out/test/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

### 5. `.vscode/tasks.json` - Build Tasks

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
      "presentation": {
        "reveal": "never"
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

### 6. `.gitignore`

```gitignore
out
node_modules
.vscode-test/
*.vsix
.DS_Store
*.log
.env
```

### 7. `.vscodeignore`

```
.vscode/**
.vscode-test/**
src/**
.gitignore
.eslintrc.json
**/*.map
**/*.ts
!out/**/*.js
node_modules/**
test/**
tsconfig.json
*.vsix
.DS_Store
```

---

## 💻 Source Code Files

### `src/extension.ts` - Entry Point Chuẩn

```typescript
import * as vscode from "vscode";
import { Logger } from "./utils/logger";
import { SidebarProvider } from "./providers/sidebarProvider";
import { registerCommands } from "./commands";

let logger: Logger;

export async function activate(context: vscode.ExtensionContext) {
  logger = new Logger("MyExtension");
  logger.info("Extension is being activated");

  try {
    // Initialize providers
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        SidebarProvider.viewType,
        sidebarProvider
      )
    );

    // Register commands
    registerCommands(context);

    // Initialize status bar
    const statusBarItem = createStatusBarItem();
    context.subscriptions.push(statusBarItem);

    // Listen to configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("myExtension")) {
          logger.info("Configuration changed");
          // Handle config changes
        }
      })
    );

    logger.info("Extension activated successfully");
  } catch (error) {
    logger.error("Failed to activate extension", error);
    vscode.window.showErrorMessage(
      `Failed to activate extension: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function deactivate() {
  logger?.info("Extension is being deactivated");
  // Cleanup resources
}

function createStatusBarItem(): vscode.StatusBarItem {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(rocket) My Extension";
  statusBarItem.tooltip = "Click to open My Extension";
  statusBarItem.command = "myExtension.helloWorld";
  statusBarItem.show();
  return statusBarItem;
}
```

### `src/commands/index.ts` - Command Registry

```typescript
import * as vscode from "vscode";
import { helloWorldCommand } from "./helloWorld";

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("myExtension.helloWorld", helloWorldCommand)
  );
}
```

### `src/commands/helloWorld.ts` - Sample Command

```typescript
import * as vscode from "vscode";
import { Logger } from "../utils/logger";

const logger = new Logger("HelloWorldCommand");

export async function helloWorldCommand(): Promise<void> {
  try {
    logger.info("Hello World command executed");

    const config = vscode.workspace.getConfiguration("myExtension");
    const isEnabled = config.get<boolean>("enable", true);

    if (!isEnabled) {
      vscode.window.showWarningMessage("Extension is disabled in settings");
      return;
    }

    const result = await vscode.window.showInformationMessage(
      "Hello from My Extension!",
      "Show Details",
      "Dismiss"
    );

    if (result === "Show Details") {
      vscode.window.showInformationMessage("This is a sample VSCode extension");
    }
  } catch (error) {
    logger.error("Error executing Hello World command", error);
    vscode.window.showErrorMessage("Failed to execute command");
  }
}
```

### `src/providers/sidebarProvider.ts` - Webview Provider

```typescript
import * as vscode from "vscode";
import { Logger } from "../utils/logger";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "myExtension.sidebarView";
  private _view?: vscode.WebviewView;
  private logger: Logger;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.logger = new Logger("SidebarProvider");
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      this.handleMessage(data);
    });

    this.logger.info("Webview resolved");
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case "refresh":
        this.logger.info("Refresh requested from webview");
        this.refresh();
        break;
      case "action":
        this.logger.info("Action triggered from webview", data.payload);
        break;
    }
  }

  public refresh(): void {
    if (this._view) {
      this._view.webview.html = this._getHtmlContent(this._view.webview);
    }
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
          padding: 16px;
        }
        h1 {
          font-size: 18px;
          margin-bottom: 16px;
          color: var(--vscode-foreground);
        }
        button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <h1>My Extension Sidebar</h1>
      <button onclick="sendMessage('refresh')">Refresh</button>
      
      <script>
        const vscode = acquireVsCodeApi();
        
        function sendMessage(type, payload) {
          vscode.postMessage({ type, payload });
        }
      </script>
    </body>
    </html>`;
  }
}
```

### `src/utils/logger.ts` - Logger Utility

```typescript
import * as vscode from "vscode";

export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private context: string;

  constructor(context: string) {
    this.context = context;

    if (!Logger.outputChannel) {
      Logger.outputChannel = vscode.window.createOutputChannel("My Extension");
    }
  }

  private log(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [${this.context}] ${message}`;

    Logger.outputChannel.appendLine(logMessage);

    if (data) {
      Logger.outputChannel.appendLine(JSON.stringify(data, null, 2));
    }
  }

  public info(message: string, data?: any): void {
    this.log("INFO", message, data);
  }

  public warn(message: string, data?: any): void {
    this.log("WARN", message, data);
  }

  public error(message: string, error?: any): void {
    this.log("ERROR", message, error);
    if (error instanceof Error) {
      Logger.outputChannel.appendLine(error.stack || "");
    }
  }

  public show(): void {
    Logger.outputChannel.show();
  }
}
```

### `src/types/index.ts` - Type Definitions

```typescript
export interface ExtensionConfig {
  enable: boolean;
  refreshInterval: number;
}

export interface WebviewMessage {
  type: string;
  payload?: any;
}

export interface StatusData {
  status: "active" | "inactive" | "error";
  message: string;
  timestamp: Date;
}
```

---

## 🔧 Scripts Để Chạy

```bash
# Install dependencies
yarn install

# Compile TypeScript
yarn compile

# Watch mode (auto-compile)
yarn watch

# Run tests
yarn test

# Lint code
yarn lint

# Package extension
yarn package

# Debug: Press F5 in VSCode
```

---

## 📦 Workflow Phát Triển

1. **Development**:

   - Chạy `yarn watch`
   - Nhấn F5 để debug
   - Sửa code → Auto compile → Reload extension (Ctrl+R trong Extension Host)

2. **Testing**:

   - Viết tests trong `test/suite/`
   - Chạy `yarn test`

3. **Package**:

   - `yarn package` → tạo `.vsix` file
   - Install: `code --install-extension my-extension-0.0.1.vsix`

4. **Publish** (optional):
   - Tạo publisher account trên [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
   - `vsce login <publisher-name>`
   - `yarn publish`

---

## 🎯 Best Practices Đã Áp Dụng

✅ **Modular structure** - Tách commands, providers, services  
✅ **Type safety** - TypeScript strict mode  
✅ **Error handling** - Try-catch với logging  
✅ **Resource cleanup** - Proper disposal  
✅ **Configuration** - User settings support  
✅ **Logging** - Output channel cho debugging  
✅ **ESLint** - Code quality  
✅ **Testing** - Test framework setup

---

Đây là cấu trúc **production-ready** và **scalable** cho VSCode extension! 🚀
