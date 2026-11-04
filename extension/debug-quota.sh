#!/bin/bash
# Debug script to see raw quota response

echo "🔍 Finding Antigravity process..."

# Detect OS and set process name
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        PROCESS_NAME="language_server_macos_arm"
    else
        PROCESS_NAME="language_server_macos"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [[ $(uname -m) == "aarch64" ]]; then
        PROCESS_NAME="language_server_linux_arm"
    else
        PROCESS_NAME="language_server_linux_x64"
    fi
else
    echo "❌ OS không được hỗ trợ: $OSTYPE"
    exit 1
fi

PROCESS_INFO=$(pgrep -fl "$PROCESS_NAME" 2>/dev/null | head -1) || true

if [[ -z "$PROCESS_INFO" ]]; then
    echo "❌ Antigravity not running"
    exit 1
fi

PID=$(echo "$PROCESS_INFO" | awk '{print $1}')
CSRF_TOKEN=$(echo "$PROCESS_INFO" | grep -oE '\-\-csrf_token[= ]+[a-zA-Z0-9\-]+' | sed 's/--csrf_token[= ]*//')

if [[ "$OSTYPE" == "darwin"* ]]; then
    PORTS=$(lsof -nP -a -iTCP -sTCP:LISTEN -p "$PID" 2>/dev/null | grep -oE ':\d+' | sed 's/://' | sort -u)
else
    PORTS=$(ss -tlnp 2>/dev/null | grep "pid=$PID" | grep -oE ':\d+' | sed 's/://' | sort -u)
    if [[ -z "$PORTS" ]]; then
        PORTS=$(lsof -nP -a -iTCP -sTCP:LISTEN -p "$PID" 2>/dev/null | grep -oE ':\d+' | sed 's/://' | sort -u)
    fi
fi

for PORT in $PORTS; do
    RESPONSE=$(curl -s -k -X POST "https://127.0.0.1:${PORT}/exa.language_server_pb.LanguageServerService/GetUnleashData" \
        -H "Content-Type: application/json" \
        -H "X-Codeium-Csrf-Token: ${CSRF_TOKEN}" \
        -H "Connect-Protocol-Version: 1" \
        -d '{"wrapper_data":{}}' \
        --connect-timeout 2 2>/dev/null) || true
    
    if [[ -n "$RESPONSE" ]] && echo "$RESPONSE" | grep -q "{"; then
        WORKING_PORT=$PORT
        break
    fi
done

echo "✓ Port: $WORKING_PORT"
echo ""
echo "📊 Raw quota response (quotaInfo only):"
echo "============================================"

curl -s -k -X POST "https://127.0.0.1:${WORKING_PORT}/exa.language_server_pb.LanguageServerService/GetUserStatus" \
    -H "Content-Type: application/json" \
    -H "X-Codeium-Csrf-Token: ${CSRF_TOKEN}" \
    -H "Connect-Protocol-Version: 1" \
    -d '{"metadata":{"ideName":"antigravity"}}' | python3 -c "
import json
import sys
from datetime import datetime

data = json.load(sys.stdin)
models = data.get('userStatus', {}).get('cascadeModelConfigData', {}).get('clientModelConfigs', [])

print(f'Current time: {datetime.now().isoformat()}')
print(f'Current UTC:  {datetime.utcnow().isoformat()}Z')
print()

for m in models:
    quota = m.get('quotaInfo')
    if quota:
        label = m.get('label', 'Unknown')
        remaining = quota.get('remainingFraction', 'N/A')
        reset_time = quota.get('resetTime', 'N/A')
        
        print(f'Model: {label}')
        print(f'  remainingFraction: {remaining}')
        print(f'  resetTime (raw):   {reset_time}')
        
        if reset_time and reset_time != 'N/A':
            try:
                dt = datetime.fromisoformat(reset_time.replace('Z', '+00:00'))
                now = datetime.now(dt.tzinfo)
                diff = dt - now
                print(f'  resetTime (parsed): {dt}')
                print(f'  diff (seconds):     {diff.total_seconds()}')
            except Exception as e:
                print(f'  parse error: {e}')
        print()
"
