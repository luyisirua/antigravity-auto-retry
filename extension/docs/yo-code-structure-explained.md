# Giải Thích Chi Tiết Cấu Trúc `yo code` Tạo Ra

## 🎯 Khi Chạy `yo code`

```bash
yo code

# Chọn:
# ? What type of extension do you want to create?
#   > New Extension (TypeScript)
# ? What's the name of your extension? my-extension
# ? What's the identifier of your extension? my-extension
# ? What's the description of your extension? My awesome extension
# ? Initialize a git repository? Yes
# ? Which bundler to use? esbuild (hoặc webpack)
# ? Which package manager to use? yarn
```

---

## 📁 Cấu Trúc Được Tạo Ra

```
my-extension/
├── .vscode/                    # VSCode workspace settings
│   ├── extensions.json         # Recommended extensions
│   ├── launch.json            # Debug configurations
│   ├── settings.json          # Workspace settings
│   └── tasks.json             # Build tasks
├── src/
│   ├── extension.ts           # 🔥 ENTRY POINT - File chính
│   └── test/
│       ├── extension.test.ts  # Unit tests
│       └── index.ts           # Test runner setup
├── .eslintrc.json             # ESLint configuration
├── .gitignore                 # Git ignore rules
├── .vscodeignore              # Files to exclude from .vsix
├── CHANGELOG.md               # Version history
├── package.json               # 🔥 MANIFEST - Định nghĩa extension
├── README.md                  # Documentation
├── tsconfig.json              # TypeScript compiler config
└── vsc-extension-quickstart.md # Quick start guide
```

---

## 📄 Chi Tiết Từng File/Folder

### 1. `.vscode/` - Workspace Configuration

Folder này chứa config cho VSCode workspace, giúp development experience tốt hơn.

#### `.vscode/extensions.json`

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint" // Khuyến nghị install ESLint extension
  ]
}
```

**Mục đích**: Khi teammate mở project, VSCode sẽ suggest install ESLint extension.

---

#### `.vscode/launch.json` - Debug Configuration

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
        "--extensionTestsPath=${workspaceFolder}/out/test/index"
      ],
      "outFiles": ["${workspaceFolder}/out/test/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

**Giải thích từng phần:**

- **`"name": "Run Extension"`**: Tên hiển thị trong debug panel
- **`"type": "extensionHost"`**: Chạy trong VSCode Extension Host (một instance VSCode riêng)
- **`"extensionDevelopmentPath"`**: Đường dẫn đến extension đang develop
- **`"outFiles"`**: Nơi chứa compiled JS files để debug
- **`"preLaunchTask"`**: Task chạy trước khi debug (compile TypeScript)

**Cách dùng**: Nhấn **F5** → VSCode sẽ:

1. Compile TypeScript (`preLaunchTask`)
2. Mở Extension Development Host window
3. Load extension của bạn vào đó
4. Attach debugger

---

#### `.vscode/tasks.json` - Build Tasks

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

**Giải thích:**

- **`"script": "watch"`**: Chạy `npm run watch` (compile TypeScript ở watch mode)
- **`"problemMatcher": "$tsc-watch"`**: Parse TypeScript compiler errors và hiển thị trong Problems panel
- **`"isBackground": true`**: Task chạy background, không block
- **`"isDefault": true`**: Task mặc định khi nhấn Cmd+Shift+B

**Cách dùng**:

- Cmd+Shift+B → Chạy watch mode
- Hoặc tự động chạy khi nhấn F5 (do `preLaunchTask`)

---

#### `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "eslint.validate": ["typescript"],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

**Mục đích**: Settings riêng cho workspace này (không ảnh hưởng global settings).

---

### 2. `src/extension.ts` - Entry Point

Đây là **file quan trọng nhất**, được gọi khi extension activate.

```typescript
import * as vscode from "vscode";

// ✅ PHẢI CÓ: Được gọi khi extension activate
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "my-extension" is now active!');

  // Đăng ký command
  const disposable = vscode.commands.registerCommand(
    "my-extension.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello World from my-extension!");
    }
  );

  // Thêm vào subscriptions để auto cleanup
  context.subscriptions.push(disposable);
}

// ✅ PHẢI CÓ: Được gọi khi extension deactivate
export function deactivate() {
  // Cleanup resources nếu cần
}
```

**Giải thích chi tiết:**

#### `activate(context: vscode.ExtensionContext)`

- **Khi nào được gọi?** Dựa vào `activationEvents` trong `package.json`
- **`context`**: Object chứa thông tin về extension
  - `context.subscriptions`: Array để register disposables (auto cleanup)
  - `context.extensionPath`: Đường dẫn đến extension folder
  - `context.globalState`: Persistent storage (global)
  - `context.workspaceState`: Persistent storage (per workspace)
  - `context.extensionUri`: URI của extension

#### `vscode.commands.registerCommand()`

- **Arg 1**: Command ID (phải match với `package.json`)
- **Arg 2**: Handler function
- **Return**: Disposable object (để cleanup)

#### `context.subscriptions.push()`

- Khi extension deactivate, VSCode sẽ tự động gọi `.dispose()` trên tất cả items trong array này
- **Best practice**: Luôn push disposables vào đây

#### `deactivate()`

- Được gọi khi extension bị deactivate (VSCode đóng, extension bị disable, reload window)
- Dùng để cleanup resources (close connections, clear timers, etc.)

---

### 3. `package.json` - Manifest File

File này định nghĩa **TẤT CẢ** về extension.

```json
{
  "name": "my-extension",
  "displayName": "My Extension",
  "description": "My awesome extension",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "my-extension.helloWorld",
        "title": "Hello World"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "vscode-test"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/mocha": "^10.0.6",
    "@types/node": "20.x",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "eslint": "^8.56.0",
    "typescript": "^5.3.3",
    "@vscode/test-cli": "^0.0.4",
    "@vscode/test-electron": "^2.3.8"
  }
}
```

**Giải thích các phần quan trọng:**

#### `"engines"`

```json
"engines": {
  "vscode": "^1.85.0"
}
```

- VSCode version tối thiểu cần để chạy extension
- `^1.85.0` = từ 1.85.0 trở lên (nhưng < 2.0.0)

#### `"activationEvents"`

```json
"activationEvents": []
```

- **Mảng rỗng** = extension chỉ activate khi command được gọi (lazy activation)
- Các options khác:
  - `"onStartupFinished"`: Activate sau khi VSCode khởi động xong
  - `"onLanguage:javascript"`: Activate khi mở file JS
  - `"onView:myView"`: Activate khi view được mở
  - `"*"`: Activate ngay (⚠️ không khuyến nghị - làm chậm VSCode)

#### `"main"`

```json
"main": "./out/extension.js"
```

- Entry point sau khi compile (file JS, không phải TS)
- VSCode sẽ load file này và gọi `activate()`

#### `"contributes"`

Đây là phần **QUAN TRỌNG NHẤT** - định nghĩa những gì extension đóng góp vào VSCode.

```json
"contributes": {
  "commands": [
    {
      "command": "my-extension.helloWorld",  // Command ID
      "title": "Hello World",                // Hiển thị trong Command Palette
      "category": "My Extension"             // Prefix trong Command Palette
    }
  ]
}
```

**Flow hoạt động:**

1. User mở Command Palette (Cmd+Shift+P)
2. Gõ "Hello World"
3. VSCode thấy command `my-extension.helloWorld` trong `contributes.commands`
4. VSCode activate extension (nếu chưa active)
5. VSCode gọi handler đã register trong `extension.ts`

#### `"scripts"`

```json
"scripts": {
  "vscode:prepublish": "npm run compile",  // Chạy trước khi publish
  "compile": "tsc -p ./",                   // Compile TypeScript
  "watch": "tsc -watch -p ./",              // Watch mode
  "pretest": "npm run compile && npm run lint",
  "lint": "eslint src --ext ts",
  "test": "vscode-test"
}
```

---

### 4. `tsconfig.json` - TypeScript Config

```json
{
  "compilerOptions": {
    "module": "Node16", // Module system (CommonJS cho VSCode)
    "target": "ES2022", // JavaScript version target
    "lib": ["ES2022"], // Standard library
    "sourceMap": true, // Generate .map files cho debugging
    "rootDir": "src", // Source folder
    "outDir": "out", // Output folder
    "strict": true, // Strict type checking
    "noUnusedLocals": true, // Error on unused variables
    "noUnusedParameters": true, // Error on unused parameters
    "noImplicitReturns": true // Error on missing return
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

**Giải thích:**

- **`"module": "Node16"`**: VSCode chạy trên Node.js, dùng CommonJS modules
- **`"sourceMap": true`**: Tạo `.map` files để debug TypeScript trực tiếp (không cần xem compiled JS)
- **`"strict": true`**: Bật tất cả strict type checking (khuyến nghị)

---

### 5. `src/test/` - Testing Setup

#### `src/test/extension.test.ts`

```typescript
import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample test", () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});
```

**Giải thích:**

- **`suite()`**: Group tests (từ Mocha framework)
- **`test()`**: Individual test case
- **`assert`**: Node.js assertion library

#### `src/test/index.ts`

```typescript
import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });

  const testsRoot = path.resolve(__dirname, ".");

  // Find all test files
  const files = await glob("**/**.test.js", { cwd: testsRoot });

  // Add files to the test suite
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  return new Promise((resolve, reject) => {
    try {
      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
```

**Mục đích**: Test runner setup - tìm tất cả `*.test.js` files và chạy tests.

---

### 6. `.eslintrc.json` - Code Quality

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 6,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        "selector": "import",
        "format": ["camelCase", "PascalCase"]
      }
    ],
    "@typescript-eslint/semi": "warn",
    "curly": "warn",
    "eqeqeq": "warn",
    "no-throw-literal": "warn",
    "semi": "off"
  }
}
```

**Mục đích**: Enforce coding standards và catch common mistakes.

---

### 7. `.vscodeignore` - Package Exclusions

```
.vscode/**
.vscode-test/**
src/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/.eslintrc.json
**/*.map
**/*.ts
```

**Mục đích**: Khi chạy `vsce package`, những files này sẽ KHÔNG được include trong `.vsix` file.

**Lý do:**

- `src/**`: Chỉ cần compiled JS trong `out/`, không cần source TS
- `**/*.map`: Source maps không cần trong production
- `**/*.ts`: TypeScript source không cần
- `.vscode-test/**`: Test files không cần

---

## 🔄 Workflow Hoạt Động

### Development Flow:

```
1. Viết code trong src/extension.ts
   ↓
2. Nhấn F5
   ↓
3. VSCode chạy task "watch" (compile TypeScript)
   ↓
4. VSCode mở Extension Development Host
   ↓
5. Extension được load và activate
   ↓
6. Test extension trong Development Host
   ↓
7. Sửa code → Auto compile → Cmd+R để reload extension
```

### Testing Flow:

```
1. Viết tests trong src/test/extension.test.ts
   ↓
2. Chạy "npm run test"
   ↓
3. VSCode compile code
   ↓
4. VSCode mở Extension Test Host
   ↓
5. Chạy tất cả tests
   ↓
6. Report kết quả
```

### Package Flow:

```
1. npm run vscode:prepublish
   ↓ (chạy compile)
2. TypeScript → JavaScript (src/ → out/)
   ↓
3. vsce package
   ↓
4. Tạo .vsix file (exclude files theo .vscodeignore)
   ↓
5. my-extension-0.0.1.vsix
```

---

## 🎯 So Sánh Với Extension Hiện Tại Của Bạn

| Feature           | Extension của bạn     | yo code default                |
| ----------------- | --------------------- | ------------------------------ |
| Entry point       | ✅ `src/extension.ts` | ✅ `src/extension.ts`          |
| Testing           | ❌ Không có           | ✅ Có sẵn                      |
| ESLint            | ❌ Không có           | ✅ Có sẵn                      |
| Debug config      | ✅ Có                 | ✅ Có                          |
| Watch task        | ✅ Có                 | ✅ Có                          |
| Modular structure | ❌ Flat               | ❌ Flat (nhưng có thể mở rộng) |

---

## 💡 Tóm Tắt Các File Quan Trọng

| File                  | Mục đích                       | Bắt buộc?      |
| --------------------- | ------------------------------ | -------------- |
| `package.json`        | Manifest, định nghĩa extension | ✅ BẮT BUỘC    |
| `src/extension.ts`    | Entry point, logic chính       | ✅ BẮT BUỘC    |
| `tsconfig.json`       | TypeScript config              | ✅ BẮT BUỘC    |
| `.vscode/launch.json` | Debug configuration            | ⭐ Khuyến nghị |
| `.vscode/tasks.json`  | Build tasks                    | ⭐ Khuyến nghị |
| `.eslintrc.json`      | Code quality                   | ⭐ Khuyến nghị |
| `src/test/`           | Tests                          | 🔵 Optional    |
| `.vscodeignore`       | Package exclusions             | ⭐ Khuyến nghị |

---

Đây là cấu trúc **minimal nhưng đầy đủ** mà `yo code` tạo ra! 🚀
