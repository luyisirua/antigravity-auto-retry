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
exports.CDPClient = void 0;
const http = __importStar(require("http"));
const crypto = __importStar(require("crypto"));
// Minimal Chrome DevTools Protocol client using built-in Node.js modules only
class CDPClient {
    constructor(wsUrl) {
        this.socket = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.receiveBuffer = Buffer.alloc(0);
        this.targetWsUrl = wsUrl;
    }
    async connect(debugPort) {
        const targets = await CDPClient.getTargets(debugPort);
        const target = targets.find((t) => t.type === "page");
        if (!target?.webSocketDebuggerUrl) {
            throw new Error("No page target found");
        }
        await this.wsConnect(target.webSocketDebuggerUrl);
    }
    async connectToTarget(wsUrl) {
        this.targetWsUrl = wsUrl;
        await this.wsConnect(wsUrl);
    }
    static async getTargets(debugPort) {
        return new Promise((resolve, reject) => {
            const req = http.get(`http://127.0.0.1:${debugPort}/json`, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch {
                        reject(new Error("Invalid JSON from CDP"));
                    }
                });
            });
            req.on("error", reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error("HTTP timeout"));
            });
        });
    }
    async evaluate(expression) {
        const id = ++this.messageId;
        const message = JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: { expression },
        });
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.wsSend(message);
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error("CDP request timeout"));
                }
            }, 10000);
        });
    }
    disconnect() {
        if (this.socket) {
            try {
                const closeFrame = Buffer.alloc(6);
                closeFrame[0] = 0x88;
                closeFrame[1] = 0x80;
                crypto.randomBytes(4).copy(closeFrame, 2);
                this.socket.write(closeFrame);
            }
            catch {
                // Best-effort close frame
            }
            this.socket.destroy();
            this.socket = null;
        }
        this.pendingRequests.clear();
    }
    get isConnected() {
        return this.socket !== null && !this.socket.destroyed;
    }
    wsConnect(wsUrl) {
        return new Promise((resolve, reject) => {
            const url = new URL(wsUrl);
            const key = crypto.randomBytes(16).toString("base64");
            const req = http.request({
                hostname: url.hostname,
                port: parseInt(url.port),
                path: url.pathname + url.search,
                method: "GET",
                headers: {
                    Upgrade: "websocket",
                    Connection: "Upgrade",
                    "Sec-WebSocket-Key": key,
                    "Sec-WebSocket-Version": "13",
                },
            }, () => {
                reject(new Error("Unexpected HTTP response instead of upgrade"));
            });
            req.on("upgrade", (_res, socket) => {
                this.socket = socket;
                socket.on("data", (data) => this.handleSocketData(data));
                socket.on("error", () => this.disconnect());
                socket.on("close", () => {
                    this.socket = null;
                });
                resolve();
            });
            req.on("error", reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error("WebSocket connection timeout"));
            });
            req.end();
        });
    }
    wsSend(message) {
        if (!this.socket) {
            throw new Error("Not connected");
        }
        const payload = Buffer.from(message, "utf8");
        const mask = crypto.randomBytes(4);
        let header;
        if (payload.length < 126) {
            header = Buffer.alloc(6);
            header[0] = 0x81;
            header[1] = 0x80 | payload.length;
            mask.copy(header, 2);
        }
        else if (payload.length < 65536) {
            header = Buffer.alloc(8);
            header[0] = 0x81;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(payload.length, 2);
            mask.copy(header, 4);
        }
        else {
            header = Buffer.alloc(14);
            header[0] = 0x81;
            header[1] = 0x80 | 127;
            header.writeUInt32BE(0, 2);
            header.writeUInt32BE(payload.length, 6);
            mask.copy(header, 10);
        }
        const masked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) {
            masked[i] = payload[i] ^ mask[i % 4];
        }
        this.socket.write(Buffer.concat([header, masked]));
    }
    handleSocketData(data) {
        this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
        while (this.receiveBuffer.length >= 2) {
            const result = this.parseFrame(this.receiveBuffer);
            if (!result) {
                break;
            }
            const { payload, bytesConsumed, opcode } = result;
            this.receiveBuffer = this.receiveBuffer.subarray(bytesConsumed);
            if (opcode === 0x01) {
                this.handleTextMessage(payload.toString("utf8"));
            }
            else if (opcode === 0x08) {
                this.disconnect();
            }
            else if (opcode === 0x09) {
                this.sendPong();
            }
        }
    }
    handleTextMessage(text) {
        try {
            const message = JSON.parse(text);
            if (message.id && this.pendingRequests.has(message.id)) {
                const { resolve, reject } = this.pendingRequests.get(message.id);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    reject(new Error(message.error.message || "CDP error"));
                }
                else {
                    resolve(message.result);
                }
            }
        }
        catch {
            // Ignore unparseable messages
        }
    }
    sendPong() {
        if (!this.socket) {
            return;
        }
        const pong = Buffer.alloc(6);
        pong[0] = 0x8a;
        pong[1] = 0x80;
        crypto.randomBytes(4).copy(pong, 2);
        this.socket.write(pong);
    }
    parseFrame(buf) {
        if (buf.length < 2) {
            return null;
        }
        const opcode = buf[0] & 0x0f;
        const isMasked = (buf[1] & 0x80) !== 0;
        let payloadLength = buf[1] & 0x7f;
        let offset = 2;
        if (payloadLength === 126) {
            if (buf.length < 4) {
                return null;
            }
            payloadLength = buf.readUInt16BE(2);
            offset = 4;
        }
        else if (payloadLength === 127) {
            if (buf.length < 10) {
                return null;
            }
            const high = buf.readUInt32BE(2);
            const low = buf.readUInt32BE(6);
            payloadLength = high * 2 ** 32 + low;
            offset = 10;
        }
        if (isMasked) {
            offset += 4;
        }
        if (buf.length < offset + payloadLength) {
            return null;
        }
        let payload;
        if (isMasked) {
            const maskKey = buf.subarray(offset - 4, offset);
            payload = Buffer.alloc(payloadLength);
            for (let i = 0; i < payloadLength; i++) {
                payload[i] = buf[offset + i] ^ maskKey[i % 4];
            }
        }
        else {
            payload = buf.subarray(offset, offset + payloadLength);
        }
        return { payload, bytesConsumed: offset + payloadLength, opcode };
    }
}
exports.CDPClient = CDPClient;
//# sourceMappingURL=cdp_client.js.map