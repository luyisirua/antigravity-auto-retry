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
exports.SidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
class SidebarProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._autoRetryEnabled = false;
        this._debugModeActive = false;
    }
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    setAutoRetryToggleHandler(handler) {
        this._onToggleAutoRetry = handler;
    }
    setRestartWithDebugHandler(handler) {
        this._onRestartWithDebug = handler;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtmlContent();
        webviewView.webview.onDidReceiveMessage((data) => {
            if (data.type === "refresh") {
                vscode.commands.executeCommand("simpleAgq.refresh");
            }
            else if (data.type === "toggleAutoRetry") {
                this._onToggleAutoRetry?.(data.enabled);
            }
            else if (data.type === "restartWithDebug") {
                this._onRestartWithDebug?.();
            }
        });
    }
    updateQuota(data) {
        this._quotaData = data;
        if (this._view) {
            this._view.webview.html = this._getHtmlContent();
        }
    }
    showError(message) {
        this._quotaData = undefined;
        if (this._view) {
            this._view.webview.html = this._getErrorHtml(message);
        }
    }
    showLoading() {
        if (this._view) {
            this._view.webview.html = this._getLoadingHtml();
        }
    }
    updateAutoRetryState(enabled, error) {
        this._autoRetryEnabled = enabled;
        this._autoRetryError = error;
        if (this._view) {
            this._view.webview.html = this._getHtmlContent();
        }
    }
    updateDebugModeState(active) {
        this._debugModeActive = active;
        if (this._view) {
            this._view.webview.html = this._getHtmlContent();
        }
    }
    _getHtmlContent() {
        if (!this._quotaData) {
            return this._getLoadingHtml();
        }
        const data = this._quotaData;
        const modelsHtml = data.models
            .map((model) => {
            const pct = model.remainingPercent;
            let statusClass = "status-ok";
            let statusIcon = "✓";
            if (model.isExhausted) {
                statusClass = "status-error";
                statusIcon = "✗";
            }
            else if (pct <= 20) {
                statusClass = "status-warning";
                statusIcon = "!";
            }
            const resetText = model.resetTimeFormatted
                ? `reset: ${this.escapeHtml(model.resetTimeFormatted)}`
                : "";
            return `
          <div class="model-item">
            <div class="model-header">
              <span class="status-icon ${statusClass}">${statusIcon}</span>
              <span class="model-name">${this.escapeHtml(model.label)}</span>
              <span class="model-percent">${pct.toFixed(1)}%</span>
            </div>
            <div class="progress-container">
              <div class="progress-bar ${statusClass}" style="width: ${pct}%"></div>
            </div>
            <div class="reset-time">${resetText}</div>
          </div>
        `;
        })
            .join("");
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
      padding: 12px;
      background: transparent;
    }
    
    .header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    
    .user-icon {
      font-size: 16px;
    }
    
    .user-name {
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    
    .user-email {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .user-plan {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      margin-top: 2px;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
    
    .model-item {
      margin-bottom: 14px;
    }
    
    .model-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    
    .status-icon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      flex-shrink: 0;
    }
    
    .status-ok {
      background: #2ea043;
      color: white;
    }
    
    .status-warning {
      background: #d29922;
      color: white;
    }
    
    .status-error {
      background: #f85149;
      color: white;
    }
    
    .model-name {
      flex: 1;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .model-percent {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      min-width: 45px;
      text-align: right;
    }
    
    .progress-container {
      height: 6px;
      background: var(--vscode-progressBar-background);
      border-radius: 3px;
      overflow: hidden;
      opacity: 0.3;
    }
    
    .progress-bar {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    
    .progress-bar.status-ok {
      background: #2ea043;
    }
    
    .progress-bar.status-warning {
      background: #d29922;
    }
    
    .progress-bar.status-error {
      background: #f85149;
    }
    
    .reset-time {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      text-align: right;
    }
    
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-widget-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .last-update {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    
    .refresh-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .refresh-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .auto-retry-section {
      margin-top: 12px;
      margin-bottom: 16px;
      padding: 10px;
      background: var(--vscode-sideBar-background, rgba(255,255,255,0.03));
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
    }

    .auto-retry-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .auto-retry-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .auto-retry-icon {
      font-size: 14px;
    }

    .toggle-switch {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
      border-radius: 10px;
      transition: background 0.2s;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      left: 2px;
      bottom: 2px;
      background: var(--vscode-foreground);
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle-switch input:checked + .toggle-slider {
      background: #2ea043;
      border-color: #2ea043;
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(16px);
      background: white;
    }

    .auto-retry-status {
      font-size: 10px;
      margin-top: 4px;
      color: var(--vscode-descriptionForeground);
    }

    .auto-retry-status.active {
      color: #2ea043;
    }

    .auto-retry-status.error {
      color: var(--vscode-errorForeground);
    }

    .debug-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      margin-bottom: 10px;
    }

    .debug-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .debug-dot.active {
      background: #2ea043;
      box-shadow: 0 0 4px #2ea04380;
    }

    .debug-dot.inactive {
      background: #f85149;
      box-shadow: 0 0 4px #f8514980;
    }

    .restart-btn {
      width: 100%;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 5px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .restart-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .toggle-switch.disabled {
      opacity: 0.4;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="user-info">
      <span class="user-icon">👤</span>
      <span class="user-name">${this.escapeHtml(data.user.name)}</span>
    </div>
    <div class="user-email">${this.escapeHtml(data.user.email)}</div>
    <div class="user-plan">Plan: ${this.escapeHtml(data.user.plan)}</div>
  </div>
  
  <div class="auto-retry-section">
    <div class="debug-status">
      <span class="debug-dot ${this._debugModeActive ? "active" : "inactive"}"></span>
      Debug Mode: ${this._debugModeActive ? "Active" : "Inactive"}
    </div>

    ${!this._debugModeActive ? `<button class="restart-btn" onclick="restartWithDebug()">
      ⟳ Restart with Debug Mode
    </button>` : ""}

    <div class="auto-retry-row">
      <span class="auto-retry-label">
        <span class="auto-retry-icon">🔄</span>
        Auto Retry
      </span>
      <label class="toggle-switch ${!this._debugModeActive ? "disabled" : ""}">
        <input type="checkbox" id="autoRetryToggle" ${this._autoRetryEnabled ? "checked" : ""} ${!this._debugModeActive ? "disabled" : ""} onchange="toggleAutoRetry(this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="auto-retry-status ${this._autoRetryEnabled ? "active" : ""} ${this._autoRetryError ? "error" : ""}">
      ${!this._debugModeActive ? "Enable Debug Mode to use Auto Retry" : this._autoRetryError ? this._autoRetryError : this._autoRetryEnabled ? "Active — auto-clicking retry buttons" : "Disabled"}
    </div>
  </div>

  <div class="section-title">Model Quotas</div>
  
  ${modelsHtml}
  
  <div class="footer">
    <span class="last-update">Updated: ${data.fetchedAt.toLocaleTimeString()}</span>
    <button class="refresh-btn" onclick="refresh()">
      ↻ Refresh
    </button>
  </div>


  
  <script>
    const vscode = acquireVsCodeApi();
    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }
    function toggleAutoRetry(enabled) {
      vscode.postMessage({ type: 'toggleAutoRetry', enabled: enabled });
    }
    function restartWithDebug() {
      vscode.postMessage({ type: 'restartWithDebug' });
    }
  </script>
</body>
</html>`;
    }
    _getLoadingHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--vscode-progressBar-background);
      border-top-color: var(--vscode-textLink-foreground);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .text {
      margin-top: 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="text">Loading quota...</div>
</body>
</html>`;
    }
    _getErrorHtml(message) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      text-align: center;
    }
    .icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    .message {
      font-size: 12px;
      color: var(--vscode-errorForeground);
      margin-bottom: 16px;
    }
    .retry-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 16px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .retry-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="icon">⚠️</div>
  <div class="message">${this.escapeHtml(message)}</div>
  <button class="retry-btn" onclick="refresh()">Retry</button>
  <script>
    const vscode = acquireVsCodeApi();
    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }
  </script>
</body>
</html>`;
    }
}
exports.SidebarProvider = SidebarProvider;
SidebarProvider.viewType = "agq.quotaView";
//# sourceMappingURL=sidebar_provider.js.map