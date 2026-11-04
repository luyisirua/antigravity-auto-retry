#!/bin/bash
# Debug script to check Unleash feature flags + full model config from Antigravity

echo "🔍 Finding Antigravity process..."

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
    echo "❌ Unsupported OS: $OSTYPE"
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

if [[ -z "$WORKING_PORT" ]]; then
    echo "❌ Could not find working port"
    exit 1
fi

echo "✓ Port: $WORKING_PORT"
echo "✓ PID: $PID"
echo ""

# ============================================
# Section 1: Unleash Feature Flags
# ============================================
echo "🚩 Unleash Feature Flags:"
echo "============================================"

curl -s -k -X POST "https://127.0.0.1:${WORKING_PORT}/exa.language_server_pb.LanguageServerService/GetUnleashData" \
    -H "Content-Type: application/json" \
    -H "X-Codeium-Csrf-Token: ${CSRF_TOKEN}" \
    -H "Connect-Protocol-Version: 1" \
    -d '{"wrapper_data":{}}' | python3 -c "
import json, sys

data = json.load(sys.stdin)

# Search for any Claude-related flags
all_flags = []

def extract_flags(obj, prefix=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f'{prefix}.{k}' if prefix else k
            if isinstance(v, (dict, list)):
                extract_flags(v, path)
            else:
                all_flags.append((path, v))
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            extract_flags(item, f'{prefix}[{i}]')

extract_flags(data)

claude_flags = [(k, v) for k, v in all_flags if 'claude' in str(k).lower() or 'claude' in str(v).lower() or 'anthropic' in str(k).lower() or 'anthropic' in str(v).lower()]

if claude_flags:
    print('🔴 Claude-related flags found:')
    for k, v in claude_flags:
        print(f'  {k} = {v}')
else:
    print('No Claude-specific flags found')

print()

# Show all flags with model/cascade/quota keywords
relevant_flags = [(k, v) for k, v in all_flags if any(word in str(k).lower() for word in ['model', 'cascade', 'quota', 'limit', 'restrict', 'disable', 'enable', 'block', 'tier', 'plan', 'access', 'premium', 'pro', 'lock'])]

if relevant_flags:
    print('📋 Model/access related flags:')
    for k, v in relevant_flags:
        print(f'  {k} = {v}')
else:
    print('No model/access related flags found')

print()
print(f'📊 Total flag entries: {len(all_flags)}')

# Dump all flags for manual review
print()
print('📝 All flags (for manual review):')
print('--------------------------------------------')
for k, v in sorted(all_flags):
    print(f'  {k} = {v}')
"

echo ""
echo ""

# ============================================
# Section 2: Full Model Config (all fields)
# ============================================
echo "📊 Full Model Config (all fields per model):"
echo "============================================"

curl -s -k -X POST "https://127.0.0.1:${WORKING_PORT}/exa.language_server_pb.LanguageServerService/GetUserStatus" \
    -H "Content-Type: application/json" \
    -H "X-Codeium-Csrf-Token: ${CSRF_TOKEN}" \
    -H "Connect-Protocol-Version: 1" \
    -d '{"metadata":{"ideName":"antigravity"}}' | python3 -c "
import json, sys
from datetime import datetime, timezone

data = json.load(sys.stdin)
user_status = data.get('userStatus', {})

print(f'👤 User: {user_status.get(\"name\", \"N/A\")}')
print(f'📧 Email: {user_status.get(\"email\", \"N/A\")}')

plan_info = user_status.get('planStatus', {}).get('planInfo', {})
print(f'💳 Plan: {plan_info.get(\"planName\", \"N/A\")}')
print()

models = user_status.get('cascadeModelConfigData', {}).get('clientModelConfigs', [])

now = datetime.now(timezone.utc)
print(f'🕐 Current UTC: {now.isoformat()}')
print()

for m in models:
    label = m.get('label', 'Unknown')
    is_claude = 'claude' in label.lower()
    marker = ' 🔴' if is_claude else ''

    print(f'Model: {label}{marker}')
    print(f'  All fields: {json.dumps(m, indent=4, default=str)}')
    print()
"

echo ""
echo ""

# ============================================
# Section 3: Raw JSON dump for deeper analysis
# ============================================
echo "📦 Raw GetUserStatus (top-level keys):"
echo "============================================"

curl -s -k -X POST "https://127.0.0.1:${WORKING_PORT}/exa.language_server_pb.LanguageServerService/GetUserStatus" \
    -H "Content-Type: application/json" \
    -H "X-Codeium-Csrf-Token: ${CSRF_TOKEN}" \
    -H "Connect-Protocol-Version: 1" \
    -d '{"metadata":{"ideName":"antigravity"}}' | python3 -c "
import json, sys

data = json.load(sys.stdin)
user_status = data.get('userStatus', {})

# Show all top-level keys excluding cascadeModelConfigData (already shown above)
for key in sorted(user_status.keys()):
    if key == 'cascadeModelConfigData':
        continue
    val = user_status[key]
    if isinstance(val, (dict, list)):
        print(f'{key}: {json.dumps(val, indent=2, default=str)}')
    else:
        print(f'{key}: {val}')
    print()
"
