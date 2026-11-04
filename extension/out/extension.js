"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const process = __importStar(require("process"));
const quota_service_1 = require("./quota_service");
const sidebar_provider_1 = require("./sidebar_provider");
const auto_retry_service_1 = require("./auto_retry_service");
let statusBarItem;
let quotaService;
let sidebarProvider;
let autoRetryService;
let refreshTimer;
let lastQuotaData = null;
async function activate(context) {
    quotaService = new quota_service_1.QuotaService();
    sidebarProvider = new sidebar_provider_1.SidebarProvider(context.extensionUri);
    autoRetryService = new auto_retry_service_1.AutoRetryService((running, error, shouldDisableConfig) => {
        sidebarProvider.updateAutoRetryState(running, error);
        if (shouldDisableConfig) {
            vscode.workspace.getConfiguration("simpleAgq").update("autoRetryEnabled", false, true);
        }
    });
    sidebarProvider.setAutoRetryToggleHandler(async (enabled) => {
        const config = vscode.workspace.getConfiguration("simpleAgq");
        await config.update("autoRetryEnabled", enabled, true);
        if (enabled) {
            const started = await autoRetryService.start();
            if (!started) {
                await config.update("autoRetryEnabled", false, true);
            }
        }
        else {
            await autoRetryService.stop();
        }
    });
    sidebarProvider.setRestartWithDebugHandler(() => {
        restartIdeWithDebugMode();
    });
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(sidebar_provider_1.SidebarProvider.viewType, sidebarProvider));
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "simpleAgq.showQuota";
    statusBarItem.text = "$(rocket) AGQ";
    statusBarItem.tooltip = "Click to view Antigravity Quota";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(vscode.commands.registerCommand("simpleAgq.refresh", () => refreshQuota()), vscode.commands.registerCommand("simpleAgq.showQuota", () => {
        vscode.commands.executeCommand("agq-sidebar.focus");
    }));
    const config = vscode.workspace.getConfiguration("simpleAgq");
    const interval = Math.max(30, config.get("autoRefreshInterval", 120));
    startAutoRefresh(interval);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("simpleAgq.autoRefreshInterval")) {
            const newConfig = vscode.workspace.getConfiguration("simpleAgq");
            const newInterval = Math.max(30, newConfig.get("autoRefreshInterval", 120));
            startAutoRefresh(newInterval);
        }
    }));
    refreshQuota();
    checkDebugModeAndRestore(config);
}
async function checkDebugModeAndRestore(config) {
    const debugPort = await autoRetryService.checkDebugPortAvailable();
    const isDebugActive = debugPort !== null;
    sidebarProvider.updateDebugModeState(isDebugActive);
    if (isDebugActive) {
        const autoRetryEnabled = config.get("autoRetryEnabled", false);
        if (autoRetryEnabled) {
            autoRetryService.start();
        }
        sidebarProvider.updateAutoRetryState(autoRetryEnabled);
    }
}
function restartIdeWithDebugMode() {
    vscode.window
        .showInformationMessage("Restart IDE with Debug Mode enabled?", "Restart", "Cancel")
        .then((choice) => {
        if (choice !== "Restart") {
            return;
        }
        const debugPort = 9222;
        if (process.platform === "win32") {
            restartOnWindows(debugPort);
        }
        else {
            restartOnUnix(debugPort);
        }
    });
}
function restartOnWindows(debugPort) {
    // vscode.env.appRoot = e.g. "C:\Users\X\AppData\Local\Programs\Antigravity\resources\app"
    // The actual IDE executable is 2 levels up from appRoot.
    const ideDir = path.resolve(vscode.env.appRoot, "..", "..");
    // Find the main .exe in the IDE directory
    let antigravityExe = "";
    try {
        const files = fs.readdirSync(ideDir);
        const exeFile = files.find((f) => f.toLowerCase().endsWith(".exe") && f.toLowerCase().includes("antigravity"));
        if (exeFile) {
            antigravityExe = path.join(ideDir, exeFile);
        }
    }
    catch {
        // Ignore
    }
    if (!antigravityExe) {
        vscode.window.showErrorMessage(`AGQ: Cannot find Antigravity executable in ${ideDir}. Please restart manually with --remote-debugging-port=9222`);
        return;
    }
    // Write a VBScript to TEMP that waits 3s then launches Antigravity.
    // WHY VBScript? Electron uses a Windows Job Object with KILL_ON_JOB_CLOSE,
    // which kills ALL child processes when the IDE exits. spawn(detached),
    // Start-Process, and cmd /c start all create child processes that die.
    // WScript.Shell.Run creates a process through the Windows Script Host,
    // and the .vbs file itself is executed by wscript.exe which we launch
    // via WMI (Invoke-WmiMethod) to ensure it's outside the Job Object.
    const tempDir = process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp";
    const vbsPath = path.join(tempDir, "agq-restart.vbs");
    const vbsContent = [
        'WScript.Sleep 3000',
        'Set oShell = CreateObject("WScript.Shell")',
        `oShell.Run """${antigravityExe}"" --remote-debugging-port=${debugPort}", 1, False`,
    ].join("\r\n");
    fs.writeFileSync(vbsPath, vbsContent);
    // Use WMI to run the VBScript OUTSIDE the IDE's Job Object.
    // Invoke-WmiMethod asks the WMI service (a separate Windows service)
    // to create the process, so it's completely independent.
    const escapedVbsPath = vbsPath.replace(/\\/g, "\\\\");
    (0, child_process_1.exec)(`powershell -NoProfile -WindowStyle Hidden -Command "Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList 'wscript.exe ${escapedVbsPath}'"`);
    setTimeout(() => {
        vscode.commands.executeCommand("workbench.action.quit");
    }, 500);
}
function restartOnUnix(debugPort) {
    const scriptPath = "/tmp/agq-restart.sh";
    const homePath = process.env.HOME || "";
    // Validate HOME path to prevent command injection
    if (!homePath || !/^[\/\w.+-]+$/.test(homePath)) {
        vscode.window.showErrorMessage("AGQ: Invalid HOME path detected. Cannot restart.");
        return;
    }
    // No folder argument — IDE will restore all previous windows automatically
    const scriptContent = [
        "#!/bin/bash",
        "sleep 3",
        `export PATH="${homePath}/.antigravity/antigravity/bin:$PATH"`,
        `antigravity --remote-debugging-port=${debugPort}`,
        `rm -f "${scriptPath}"`,
        "",
    ].join("\n");
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    (0, child_process_1.exec)(`nohup "${scriptPath}" > /dev/null 2>&1 &`);
    setTimeout(() => {
        vscode.commands.executeCommand("workbench.action.quit");
    }, 500);
}
function startAutoRefresh(intervalSeconds) {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    refreshTimer = setInterval(() => refreshQuota(), intervalSeconds * 1000);
}
async function refreshQuota() {
    statusBarItem.text = "$(sync~spin) AGQ";
    sidebarProvider.showLoading();
    const data = await quotaService.fetchQuota();
    if (data) {
        lastQuotaData = data;
        updateStatusBar(data);
        sidebarProvider.updateQuota(data);
    }
    else {
        statusBarItem.text = "$(error) AGQ";
        statusBarItem.tooltip = "Cannot connect to Antigravity. Click to retry.";
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        sidebarProvider.showError("Cannot connect to Antigravity.\nMake sure it's running.");
    }
}
function updateStatusBar(data) {
    const lowQuotaModels = data.models.filter((m) => m.remainingPercent < 20 && !m.isExhausted);
    const exhaustedModels = data.models.filter((m) => m.isExhausted);
    let icon = "$(check)";
    let bgColor;
    if (exhaustedModels.length > 0) {
        icon = "$(error)";
        bgColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    }
    else if (lowQuotaModels.length > 0) {
        icon = "$(warning)";
        bgColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    }
    statusBarItem.text = `${icon} AGQ`;
    statusBarItem.backgroundColor = bgColor;
    statusBarItem.tooltip = `Antigravity Quota - ${data.models.length} models\nClick to open sidebar`;
}
function deactivate() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    autoRetryService?.dispose();
}
//# sourceMappingURL=extension.js.map