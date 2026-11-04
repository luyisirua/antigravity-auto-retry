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
exports.ProcessFinder = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const https = __importStar(require("https"));
const process = __importStar(require("process"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ProcessFinder {
    constructor() {
        if (process.platform === "darwin") {
            this.processName =
                process.arch === "arm64"
                    ? "language_server_macos_arm"
                    : "language_server_macos";
        }
        else if (process.platform === "linux") {
            this.processName =
                process.arch === "arm64"
                    ? "language_server_linux_arm"
                    : "language_server_linux_x64";
        }
        else {
            this.processName = "language_server.exe";
        }
    }
    async findProcess() {
        try {
            const processInfo = await this.getProcessInfo();
            if (!processInfo)
                return null;
            const ports = await this.getListeningPorts(processInfo.pid);
            const workingPort = await this.findWorkingPort(ports, processInfo.csrfToken);
            if (!workingPort)
                return null;
            return {
                pid: processInfo.pid,
                port: workingPort,
                csrfToken: processInfo.csrfToken,
            };
        }
        catch {
            return null;
        }
    }
    async getProcessInfo() {
        try {
            let cmd;
            if (process.platform === "win32") {
                // Use Where-Object instead of -Filter to avoid nested quote escaping
                // issues when passing through Node.js â†?cmd.exe â†?PowerShell
                const psScript = `Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'language_server*.exe' } | Select-Object ProcessId,CommandLine | ConvertTo-Json`;
                cmd = `powershell -NoProfile -Command "${psScript}"`;
            }
            else {
                cmd = `pgrep -fl ${this.processName}`;
            }
            const { stdout } = await execAsync(cmd);
            return this.parseProcessOutput(stdout);
        }
        catch {
            return null;
        }
    }
    parseProcessOutput(stdout) {
        if (process.platform === "win32") {
            return this.parseWindowsOutput(stdout);
        }
        return this.parseUnixOutput(stdout);
    }
    parseWindowsOutput(stdout) {
        try {
            let data = JSON.parse(stdout.trim());
            if (Array.isArray(data)) {
                // Already filtered by process name, just find one with csrf_token
                data = data.find((p) => p.CommandLine?.includes("--csrf_token"));
            }
            if (!data)
                return null;
            const tokenMatch = data.CommandLine?.match(/--csrf_token[= ]+([a-zA-Z0-9-]+)/);
            if (!tokenMatch)
                return null;
            return {
                pid: data.ProcessId,
                csrfToken: tokenMatch[1],
            };
        }
        catch {
            return null;
        }
    }
    parseUnixOutput(stdout) {
        const lines = stdout.split("\n");
        for (const line of lines) {
            if (line.includes("--csrf_token")) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[0], 10);
                const tokenMatch = line.match(/--csrf_token[= ]+([a-zA-Z0-9-]+)/);
                if (tokenMatch) {
                    return { pid, csrfToken: tokenMatch[1] };
                }
            }
        }
        return null;
    }
    async getListeningPorts(pid) {
        try {
            let cmd;
            if (process.platform === "darwin") {
                cmd = `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid}`;
            }
            else if (process.platform === "win32") {
                // Try Get-NetTCPConnection first; fallback to netstat if it fails
                // (Get-NetTCPConnection may require admin privileges on some systems)
                cmd = `powershell -NoProfile -Command "try { Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction Stop | Select-Object -ExpandProperty LocalPort | ConvertTo-Json } catch { $null }"`;
            }
            else {
                cmd = `ss -tlnp 2>/dev/null | grep "pid=${pid}" || lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null`;
            }
            const { stdout } = await execAsync(cmd);
            let ports = this.parsePorts(stdout, pid);
            // Windows fallback: if PowerShell approach returned nothing, try netstat
            if (ports.length === 0 && process.platform === "win32") {
                ports = await this.getListeningPortsNetstat(pid);
            }
            return ports;
        }
        catch {
            // On Windows, try netstat as last resort if PowerShell failed entirely
            if (process.platform === "win32") {
                return this.getListeningPortsNetstat(pid);
            }
            return [];
        }
    }
    /**
     * Fallback for Windows: parse netstat output to find listening ports for a PID.
     * netstat doesn't require admin privileges for basic usage.
     */
    async getListeningPortsNetstat(pid) {
        try {
            const { stdout } = await execAsync(`netstat -ano | findstr "LISTENING" | findstr " ${pid}"`);
            const ports = [];
            const lines = stdout.split("\n");
            for (const line of lines) {
                // Format: TCP    127.0.0.1:PORT    0.0.0.0:0    LISTENING    PID
                const match = line.match(/\s+(?:TCP|UDP)\s+[\d.]+:(\d+)\s+[\d.*:]+\s+LISTENING\s+(\d+)/i);
                if (match && parseInt(match[2], 10) === pid) {
                    const port = parseInt(match[1], 10);
                    if (!ports.includes(port))
                        ports.push(port);
                }
            }
            return ports;
        }
        catch {
            return [];
        }
    }
    parsePorts(stdout, pid) {
        const ports = [];
        if (process.platform === "win32") {
            try {
                const data = JSON.parse(stdout.trim());
                if (Array.isArray(data)) {
                    return data.filter((p) => typeof p === "number");
                }
                if (typeof data === "number")
                    return [data];
            }
            catch {
                return [];
            }
        }
        // lsof output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        const lsofRegex = new RegExp(`^\\S+\\s+${pid}\\s+.*?(?:TCP|UDP)\\s+(?:\\*|[\\d.]+|\\[[\\da-f:]+\\]):(\\d+)\\s+\\(LISTEN\\)`, "gim");
        let match;
        while ((match = lsofRegex.exec(stdout)) !== null) {
            const port = parseInt(match[1], 10);
            if (!ports.includes(port))
                ports.push(port);
        }
        // ss output format: LISTEN 0 128 127.0.0.1:PORT 0.0.0.0:* users:((...))
        if (ports.length === 0) {
            const ssRegex = /[\s*](?:\*|[\d.]+|\[[\da-f:]+\]):(\d+)\s/gi;
            while ((match = ssRegex.exec(stdout)) !== null) {
                const port = parseInt(match[1], 10);
                if (!ports.includes(port))
                    ports.push(port);
            }
        }
        return ports;
    }
    async findWorkingPort(ports, csrfToken) {
        for (const port of ports) {
            const works = await this.testPort(port, csrfToken);
            if (works)
                return port;
        }
        return null;
    }
    testPort(port, csrfToken) {
        return new Promise((resolve) => {
            const options = {
                hostname: "127.0.0.1",
                port,
                path: "/exa.language_server_pb.LanguageServerService/GetUnleashData",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Codeium-Csrf-Token": csrfToken,
                    "Connect-Protocol-Version": "1",
                },
                rejectUnauthorized: false,
                timeout: 3000,
            };
            const req = https.request(options, (res) => {
                let body = "";
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    if (res.statusCode === 200) {
                        try {
                            JSON.parse(body);
                            resolve(true);
                        }
                        catch {
                            resolve(false);
                        }
                    }
                    else {
                        resolve(false);
                    }
                });
            });
            req.on("error", () => resolve(false));
            req.on("timeout", () => {
                req.destroy();
                resolve(false);
            });
            req.write(JSON.stringify({ wrapper_data: {} }));
            req.end();
        });
    }
}
exports.ProcessFinder = ProcessFinder;
//# sourceMappingURL=process_finder.js.map