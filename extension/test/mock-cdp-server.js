/**
 * Mock CDP Server — Giả lập bug "Inject failed. 0 targets []"
 *
 * Cách hoạt động:
 *   Phase 1 (0 → DELAY_SECONDS): /json trả về [] → gây ra bug
 *   Phase 2 (DELAY_SECONDS →):   /json trả về [target] + WebSocket → fix nên bắt được
 *
 * Cách dùng:
 *   1. Tắt IDE đang chạy với --remote-debugging-port (nếu có)
 *   2. Chạy: node test/mock-cdp-server.js
 *   3. Mở extension → bật Auto Retry
 *   4. Trước fix: lỗi "0 targets" ngay lập tức
 *   5. Sau fix:  extension chờ polling, sau DELAY_SECONDS giây inject thành công
 *
 * Tuỳ chỉnh:
 *   DELAY_SECONDS=0  → targets luôn có sẵn (test happy path)
 *   DELAY_SECONDS=99 → targets không bao giờ xuất hiện (test timeout)
 */

const http = require("http");
const crypto = require("crypto");

// ─── Cấu hình ───────────────────────────────────────────────
const PORT = 9222;
const DELAY_SECONDS = parseInt(process.env.DELAY_SECONDS || "15", 10);
// ─────────────────────────────────────────────────────────────

const START_TIME = Date.now();
function elapsed() {
  return Math.round((Date.now() - START_TIME) / 1000);
}

function log(msg) {
  const sec = String(elapsed()).padStart(3);
  console.log(`  [${sec}s] ${msg}`);
}

// ─── HTTP Server ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // /json/version — luôn trả về OK (để findDebugPort() tìm được port)
  if (req.url === "/json/version") {
    log(`GET /json/version → 200 ✓`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        Browser: "MockCDP/1.0",
        "Protocol-Version": "1.3",
        "V8-Version": "0.0.0",
      })
    );
    return;
  }

  // /json — Phase 1: trả [], Phase 2: trả targets
  if (req.url === "/json" || req.url === "/json/list") {
    const sec = elapsed();

    if (sec < DELAY_SECONDS) {
      log(
        `GET /json → [] 🔴 (chưa có targets, còn ${DELAY_SECONDS - sec}s)`
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
    } else {
      log(`GET /json → [1 target] 🟢`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            type: "page",
            title: "Antigravity Mock Page",
            url: "https://mock.antigravity.dev",
            webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/devtools/page/MOCK001`,
          },
        ])
      );
    }
    return;
  }

  // Catch WebSocket paths in HTTP handler (should not reach here if upgrade works)
  if (req.url && req.url.startsWith("/devtools/")) {
    log(`⚠️ WebSocket path hit HTTP handler instead of upgrade: ${req.url}`);
    res.writeHead(400);
    res.end("Expected WebSocket upgrade");
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ─── WebSocket Handler (mock CDP target) ─────────────────────
server.on("upgrade", (req, socket, head) => {
  log(`WebSocket UPGRADE ${req.url} 🔌`);
  log(`  Headers: upgrade=${req.headers.upgrade}, connection=${req.headers.connection}`);
  log(`  Sec-WebSocket-Key: ${req.headers["sec-websocket-key"]}`);

  // WebSocket handshake
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    log(`  ❌ Missing Sec-WebSocket-Key header`);
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-5AB5ADFFA7E3")
    .digest("base64");

  const handshakeResponse = 
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
    "\r\n";

  socket.write(handshakeResponse, () => {
    log(`  ✓ Handshake response sent (${handshakeResponse.length} bytes)`);
  });

  // Process any data that arrived with the upgrade request
  if (head && head.length > 0) {
    log(`  Head data: ${head.length} bytes`);
    handleWsData(socket, head);
  }

  socket.on("data", (buf) => handleWsData(socket, buf));
  socket.on("error", (err) => log(`  WebSocket error: ${err.message}`));
  socket.on("close", () => log("WebSocket CLOSED"));
});

function handleWsData(socket, buf) {
  const frame = parseWsFrame(buf);
  if (!frame) {
    log(`  ⚠️ Could not parse WS frame (${buf.length} bytes)`);
    return;
  }

  try {
    const msg = JSON.parse(frame.toString());
    log(`CDP ← ${msg.method} (id=${msg.id})`);

    // Respond to Runtime.evaluate → return 'started'
    if (msg.method === "Runtime.evaluate") {
      const response = JSON.stringify({
        id: msg.id,
        result: {
          result: { type: "string", value: "started" },
        },
      });
      socket.write(createWsFrame(response));
      log(`CDP → OK (id=${msg.id}) — inject script accepted ✅`);
    } else {
      // Respond to any other method with empty result
      const response = JSON.stringify({ id: msg.id, result: {} });
      socket.write(createWsFrame(response));
      log(`CDP → OK (id=${msg.id})`);
    }
  } catch (err) {
    log(`  ⚠️ Parse error: ${err.message}`);
  }
}

// ─── WebSocket frame helpers ─────────────────────────────────
function parseWsFrame(buf) {
  if (buf.length < 2) return null;

  const isMasked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = buf.readUInt32BE(6);
    offset = 10;
  }

  if (isMasked) {
    const mask = buf.subarray(offset, offset + 4);
    offset += 4;
    const data = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      data[i] = buf[offset + i] ^ mask[i % 4];
    }
    return data;
  }

  return buf.subarray(offset, offset + payloadLen);
}

function createWsFrame(text) {
  const payload = Buffer.from(text, "utf8");
  let header;

  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text
    header[1] = payload.length; // no mask (server → client)
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(payload.length, 6);
  }

  return Buffer.concat([header, payload]);
}

// ─── Start ───────────────────────────────────────────────────
server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  ╔═══════════════════════════════════════════════════╗");
  console.log("  ║         🔧 Mock CDP Server — Bug Simulator       ║");
  console.log("  ╠═══════════════════════════════════════════════════╣");
  console.log(`  ║  Port:  ${PORT}                                     ║`);
  console.log(
    `  ║  Delay: ${String(DELAY_SECONDS).padEnd(3)}seconds                            ║`
  );
  console.log("  ╠═══════════════════════════════════════════════════╣");
  console.log(
    `  ║  Phase 1 (0─${String(DELAY_SECONDS).padEnd(2)}s):  /json → []     🔴 BUG     ║`
  );
  console.log(
    `  ║  Phase 2 (${String(DELAY_SECONDS).padEnd(2)}s─∞):  /json → [target] 🟢 OK     ║`
  );
  console.log("  ╚═══════════════════════════════════════════════════╝");
  console.log("");
  console.log("  Đợi extension gọi đến...");
  console.log("");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n  Server stopped.");
  process.exit(0);
});
