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
exports.AutoRetryService = void 0;
const child_process_1 = require("child_process");
const http = __importStar(require("http"));
const util_1 = require("util");
const process = __importStar(require("process"));
const cdp_client_1 = require("./cdp_client");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const AUTO_RETRY_INJECT_SCRIPT = `
(function() {
  if (window.__agqAutoRetryActive) return 'already_running';
  window.__agqAutoRetryActive = true;

  // Exact button texts we want to click (trimmed, lowercased).
  // Only short, unambiguous labels — NOT substring matching.
  var EXACT_LABELS = ['retry', 'try again', 'resume', 'try again…', 'retry…'];
  var FALLBACK_INTERVAL = 10000; // 10s fallback — Observer handles the fast path
  var lastClickTime = 0;
  var MIN_CLICK_INTERVAL = 5000;
  var MAX_TEXT_LENGTH = 30; // ignore buttons with very long text content
  var _checkScheduled = false;

  function checkForRetryButton() {
    _checkScheduled = false;
    if (!window.__agqAutoRetryActive) return;

    // CRITICAL GUARD: never click anything if this tab/webview is not focused.
    // In Electron, calling .click() in a background WebView can bring it to
    // the foreground — this single check prevents the "old tab keeps reopening" bug.
    if (!document.hasFocus()) return;

    var now = Date.now();
    if (now - lastClickTime < MIN_CLICK_INTERVAL) return;

    var buttons = document.querySelectorAll('button, [role="button"], .monaco-button, a.monaco-button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var rawText = (btn.textContent || '').trim();
      // Skip buttons with very long text (these are content blocks, not action buttons)
      if (rawText.length > MAX_TEXT_LENGTH || rawText.length === 0) continue;

      var text = rawText.toLowerCase();
      var ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim();

      var matched = false;
      for (var j = 0; j < EXACT_LABELS.length; j++) {
        if (text === EXACT_LABELS[j] || ariaLabel === EXACT_LABELS[j]) {
          matched = true;
          break;
        }
      }

      if (matched) {
        var rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          console.log('[AGQ Auto-Retry] Clicking button:', JSON.stringify(rawText));
          btn.click();
          lastClickTime = now;
          return;
        }
      }
    }
  }

  // Debounced check — MutationObserver fires many times per DOM change,
  // so we batch them with requestAnimationFrame to avoid redundant scans.
  function scheduleCheck() {
    if (_checkScheduled) return;
    _checkScheduled = true;
    requestAnimationFrame(checkForRetryButton);
  }

  // PRIMARY: MutationObserver — reacts instantly when retry button appears in DOM.
  // Safe to use with fire-and-forget injection (no persistent WebSocket).
  // The document.hasFocus() guard prevents any focus-stealing side effects.
  window.__agqRetryObserver = new MutationObserver(scheduleCheck);
  window.__agqRetryObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // FALLBACK: slow interval as safety net in case Observer misses something
  window.__agqRetryInterval = setInterval(checkForRetryButton, FALLBACK_INTERVAL);

  // IMMEDIATE CHECK: if the retry button is already in the DOM at injection
  // time, MutationObserver won't fire (no new mutations). Without this call,
  // the user would have to wait for the 10s fallback interval.
  // Use a small delay to let any pending renders flush first.
  setTimeout(checkForRetryButton, 500);

  console.log('[AGQ Auto-Retry] Started (hybrid: Observer + fallback interval + immediate check)');
  return 'started';
})();
`;
const AUTO_RETRY_STOP_SCRIPT = `
(function() {
  window.__agqAutoRetryActive = false;
  if (window.__agqRetryInterval) {
    clearInterval(window.__agqRetryInterval);
    window.__agqRetryInterval = null;
  }
  if (window.__agqRetryObserver) {
    window.__agqRetryObserver.disconnect();
    window.__agqRetryObserver = null;
  }
  console.log('[AGQ Auto-Retry] Stopped');
  return 'stopped';
})();
`;
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5s × 60 = 5 minutes
class AutoRetryService {
    constructor(onStatusChange) {
        this.injectedTargets = new Map();
        this.running = false;
        this.starting = false;
        this.onStatusChange = onStatusChange;
    }
    get isRunning() {
        return this.running;
    }
    async checkDebugPortAvailable() {
        return this.findDebugPort();
    }
    async start() {
        if (this.running || this.starting) {
            return true;
        }
        this.starting = true;
        try {
            const port = await this.findDebugPort();
            if (!port) {
                this.onStatusChange(false, "Cannot find IDE debug port. Start IDE with --remote-debugging-port=9222");
                return false;
            }
            this.running = true;
            // Try immediate injection
            const success = await this.tryInject(port);
            if (success) {
                this.onStatusChange(true);
                this.startNewTabMonitor(port);
            }
            else {
                // Don't fail — start polling for targets
                this.onStatusChange(true, "Waiting for targets...");
                this.startConnectionPoller(port);
            }
            return true;
        }
        finally {
            this.starting = false;
        }
    }
    async stop() {
        // Set running = false FIRST to prevent race with ongoing tryInject() calls
        this.running = false;
        this.clearReconnectTimer();
        this.clearConnectionPoller();
        // Best-effort: send stop script to all known injected targets
        const port = await this.findDebugPort();
        if (port) {
            try {
                const targets = await cdp_client_1.CDPClient.getTargets(port);
                for (const target of targets) {
                    if (!target.webSocketDebuggerUrl)
                        continue;
                    if (!this.injectedTargets.has(target.id))
                        continue;
                    try {
                        const client = new cdp_client_1.CDPClient();
                        await client.connectToTarget(target.webSocketDebuggerUrl);
                        await client.evaluate(AUTO_RETRY_STOP_SCRIPT);
                        // Disconnect immediately after — never hold the socket open
                        client.disconnect();
                    }
                    catch {
                        // Best effort
                    }
                }
            }
            catch {
                // Ignore
            }
        }
        this.injectedTargets.clear();
        this.onStatusChange(false);
    }
    dispose() {
        this.clearReconnectTimer();
        this.clearConnectionPoller();
        this.injectedTargets.clear();
        this.running = false;
    }
    /**
     * Filter: only inject into Antigravity agent-related CDP targets.
     */
    isAgentTarget(target) {
        const url = (target.url || "").toLowerCase();
        const title = (target.title || "").toLowerCase();
        // Exclude browser internals
        if (url.startsWith("devtools://") ||
            url.startsWith("chrome-extension://") ||
            url.startsWith("chrome://")) {
            return false;
        }
        // Only inject into Antigravity agent-related targets
        // Match by title keywords or known agent URL patterns
        const agentKeywords = ["antigravity", "agent", "cascade", "windsurf"];
        const isAgentByTitle = agentKeywords.some((kw) => title.includes(kw));
        const isAgentByUrl = url.includes("workbench") || url === "" || url === "about:blank";
        return isAgentByTitle || isAgentByUrl;
    }
    /**
     * Fire-and-forget injection: connect → evaluate → IMMEDIATELY disconnect.
     *
     * WHY: Keeping the CDP WebSocket open causes Electron/Antigravity to treat
     * the connected tab as "having an attached debugger" which can pull that tab
     * to the foreground. By disconnecting right after inject, the script keeps
     * running on its own (setInterval + MutationObserver survive in the page's
     * JS context) without holding the connection.
     *
     * Returns true if at least one new target was injected (or already tracked).
     */
    async tryInject(port) {
        try {
            const targets = await cdp_client_1.CDPClient.getTargets(port);
            let count = 0;
            // Remove stale tracked IDs (targets that no longer exist)
            const currentIds = new Set(targets.map((t) => t.id).filter(Boolean));
            for (const id of this.injectedTargets.keys()) {
                if (!currentIds.has(id)) {
                    this.injectedTargets.delete(id);
                }
            }
            for (const target of targets) {
                if (!target.webSocketDebuggerUrl || !target.id)
                    continue;
                if (!this.isAgentTarget(target))
                    continue;
                // Already injected with the same URL → skip (page hasn't navigated)
                const tracked = this.injectedTargets.get(target.id);
                if (tracked && tracked.url === target.url) {
                    count++;
                    continue;
                }
                // New target or page navigated → inject
                try {
                    const client = new cdp_client_1.CDPClient();
                    await client.connectToTarget(target.webSocketDebuggerUrl);
                    await client.evaluate(AUTO_RETRY_INJECT_SCRIPT);
                    // ← Disconnect immediately. Script keeps running on its own.
                    client.disconnect();
                    this.injectedTargets.set(target.id, { url: target.url });
                    count++;
                }
                catch {
                    // Skip this target, try next
                }
            }
            return count > 0;
        }
        catch {
            return false;
        }
    }
    /**
     * Polls for targets when initial injection fails (e.g. IDE not yet ready).
     * Retries every 5s for up to 5 minutes.
     */
    startConnectionPoller(port) {
        this.clearConnectionPoller();
        let attempts = 0;
        this.connectionPoller = setInterval(async () => {
            if (!this.running) {
                this.clearConnectionPoller();
                return;
            }
            attempts++;
            const success = await this.tryInject(port);
            if (success) {
                this.clearConnectionPoller();
                this.onStatusChange(true);
                this.startNewTabMonitor(port);
            }
            else if (attempts >= MAX_POLL_ATTEMPTS) {
                this.clearConnectionPoller();
                this.running = false;
                this.onStatusChange(false, "Timed out waiting for targets after 5 minutes. Try restarting with Debug Mode.", true // Signal extension to reset autoRetryEnabled in config
                );
            }
        }, POLL_INTERVAL_MS);
    }
    clearConnectionPoller() {
        if (this.connectionPoller) {
            clearInterval(this.connectionPoller);
            this.connectionPoller = undefined;
        }
    }
    /**
     * Lightweight monitor: every 30s, check /json (HTTP only, no WebSocket)
     * for new agent tabs that haven't been injected yet and inject them.
     * No persistent connections are held.
     */
    startNewTabMonitor(port) {
        this.clearReconnectTimer();
        this.reconnectTimer = setInterval(async () => {
            if (!this.running) {
                return;
            }
            await this.tryInject(port);
        }, 30000);
    }
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }
    async findDebugPort() {
        const portFromArgs = await this.findPortFromProcessArgs();
        if (portFromArgs) {
            return portFromArgs;
        }
        // Fallback: try common debug ports
        const commonPorts = [9222, 9229, 9230, 9333];
        for (const port of commonPorts) {
            const isAvailable = await this.testDebugPort(port);
            if (isAvailable) {
                return port;
            }
        }
        return null;
    }
    async findPortFromProcessArgs() {
        try {
            let cmd;
            if (process.platform === "win32") {
                // On Windows, search for any process with remote-debugging-port
                // (don't filter by 'antigravity' as install path may vary)
                cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port' } | Select-Object CommandLine | ConvertTo-Json"`;
            }
            else {
                cmd = `ps aux | grep -i 'remote-debugging-port' | grep -i 'antigravity' | grep -iv grep`;
            }
            const { stdout } = await execAsync(cmd);
            const match = stdout.match(/--remote-debugging-port[= ](\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        catch {
            // Process search failed
        }
        return null;
    }
    async testDebugPort(port) {
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on("error", () => resolve(false));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
}
exports.AutoRetryService = AutoRetryService;
//# sourceMappingURL=auto_retry_service.js.map