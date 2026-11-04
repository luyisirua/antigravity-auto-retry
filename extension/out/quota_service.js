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
exports.QuotaService = void 0;
const https = __importStar(require("https"));
const process_finder_1 = require("./process_finder");
const types_1 = require("./types");
class QuotaService {
    constructor() {
        this.processInfo = null;
        this.processFinder = new process_finder_1.ProcessFinder();
    }
    async connect() {
        this.processInfo = await this.processFinder.findProcess();
        return this.processInfo !== null;
    }
    async fetchQuota() {
        if (!this.processInfo) {
            const connected = await this.connect();
            if (!connected)
                return null;
        }
        try {
            const response = await this.request("/exa.language_server_pb.LanguageServerService/GetUserStatus", {
                metadata: {
                    ideName: "antigravity",
                    extensionName: "antigravity",
                    locale: "en",
                },
            });
            return this.parseResponse(response);
        }
        catch {
            this.processInfo = null;
            return null;
        }
    }
    request(path, body) {
        return new Promise((resolve, reject) => {
            if (!this.processInfo) {
                reject(new Error("Not connected"));
                return;
            }
            const data = JSON.stringify(body);
            const options = {
                hostname: "127.0.0.1",
                port: this.processInfo.port,
                path,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(data),
                    "Connect-Protocol-Version": "1",
                    "X-Codeium-Csrf-Token": this.processInfo.csrfToken,
                },
                rejectUnauthorized: false,
                timeout: 5000,
            };
            const req = https.request(options, (res) => {
                let body = "";
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(body));
                    }
                    catch {
                        reject(new Error("Invalid JSON"));
                    }
                });
            });
            req.on("error", reject);
            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Timeout"));
            });
            req.write(data);
            req.end();
        });
    }
    parseResponse(data) {
        const userStatus = data.userStatus;
        const models = (userStatus.cascadeModelConfigData?.clientModelConfigs || [])
            .filter((m) => m.quotaInfo)
            .map((m) => {
            const hasRemainingFraction = m.quotaInfo?.remainingFraction !== undefined;
            const resetTimeStr = m.quotaInfo?.resetTime;
            // If no remainingFraction but has resetTime → exhausted (0%)
            // If no remainingFraction and no resetTime → unlimited (100%)
            const rawRemaining = hasRemainingFraction
                ? m.quotaInfo.remainingFraction
                : (resetTimeStr ? 0 : 1);
            // Clamp to [0, 1] to prevent progress bar overflow from data anomalies
            const remaining = Math.min(1, Math.max(0, rawRemaining));
            let resetTime = null;
            let resetTimeFormatted = "";
            if (resetTimeStr) {
                resetTime = new Date(resetTimeStr);
                const now = new Date();
                const diff = resetTime.getTime() - now.getTime();
                if (diff > 0) {
                    const hours = Math.floor(diff / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                    const resetHour = resetTime.getHours().toString().padStart(2, "0");
                    const resetMin = resetTime.getMinutes().toString().padStart(2, "0");
                    const resetTimeLocal = `${resetHour}:${resetMin}`;
                    resetTimeFormatted = `${duration} (${resetTimeLocal})`;
                }
                else {
                    resetTimeFormatted = "Ready";
                }
            }
            return {
                label: m.label,
                modelId: m.modelOrAlias?.model || "unknown",
                remainingPercent: remaining * 100,
                isExhausted: remaining === 0,
                resetTime,
                resetTimeFormatted,
            };
        })
            .sort((a, b) => {
            const aIndex = types_1.MODEL_ORDER.indexOf(a.label);
            const bIndex = types_1.MODEL_ORDER.indexOf(b.label);
            const aOrder = aIndex === -1 ? types_1.MODEL_ORDER.length : aIndex;
            const bOrder = bIndex === -1 ? types_1.MODEL_ORDER.length : bIndex;
            return aOrder - bOrder;
        });
        return {
            user: {
                name: userStatus.name || "N/A",
                email: userStatus.email || "N/A",
                plan: userStatus.planStatus?.planInfo?.planName || "N/A",
            },
            models,
            fetchedAt: new Date(),
        };
    }
}
exports.QuotaService = QuotaService;
//# sourceMappingURL=quota_service.js.map