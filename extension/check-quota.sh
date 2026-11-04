#!/bin/bash
#
# Antigravity Quota Checker
# Script đơn giản để xem quota của các AI models trong Antigravity IDE
# Không cần cài đặt package nào - chỉ dùng công cụ có sẵn trên macOS/Linux
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     ${BOLD}Antigravity Quota Checker${NC}${CYAN}              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

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
    echo -e "${RED}❌ OS không được hỗ trợ: $OSTYPE${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Đang tìm process: ${PROCESS_NAME}...${NC}"

# Find the Antigravity language server process
PROCESS_INFO=$(pgrep -fl "$PROCESS_NAME" 2>/dev/null | head -1) || true

if [[ -z "$PROCESS_INFO" ]]; then
    echo -e "${RED}❌ Không tìm thấy process Antigravity.${NC}"
    echo -e "${YELLOW}   Hãy chắc chắn Antigravity IDE đang chạy.${NC}"
    exit 1
fi

# Extract PID
PID=$(echo "$PROCESS_INFO" | awk '{print $1}')
echo -e "${GREEN}✓ Tìm thấy process PID: ${PID}${NC}"

# Extract CSRF token from command line
CSRF_TOKEN=$(echo "$PROCESS_INFO" | grep -oE '\-\-csrf_token[= ]+[a-zA-Z0-9\-]+' | sed 's/--csrf_token[= ]*//')

if [[ -z "$CSRF_TOKEN" ]]; then
    echo -e "${RED}❌ Không tìm thấy CSRF token trong command line.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ CSRF Token: ${CSRF_TOKEN:0:8}...${NC}"

# Find listening port using lsof
echo -e "${BLUE}🔍 Đang tìm port...${NC}"

if [[ "$OSTYPE" == "darwin"* ]]; then
    PORTS=$(lsof -nP -a -iTCP -sTCP:LISTEN -p "$PID" 2>/dev/null | grep -oE ':\d+' | sed 's/://' | sort -u)
else
    PORTS=$(ss -tlnp 2>/dev/null | grep "pid=$PID" | grep -oE ':\d+' | sed 's/://' | sort -u)
    if [[ -z "$PORTS" ]]; then
        PORTS=$(lsof -nP -a -iTCP -sTCP:LISTEN -p "$PID" 2>/dev/null | grep -oE ':\d+' | sed 's/://' | sort -u)
    fi
fi

if [[ -z "$PORTS" ]]; then
    echo -e "${RED}❌ Không tìm thấy port nào đang listen.${NC}"
    exit 1
fi

# Try each port to find the working one
WORKING_PORT=""
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
    echo -e "${RED}❌ Không thể kết nối đến Antigravity server.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Kết nối thành công port: ${WORKING_PORT}${NC}"
echo ""

# Fetch quota data
echo -e "${BLUE}📊 Đang lấy thông tin quota...${NC}"
echo ""

QUOTA_RESPONSE=$(curl -s -k -X POST "https://127.0.0.1:${WORKING_PORT}/exa.language_server_pb.LanguageServerService/GetUserStatus" \
    -H "Content-Type: application/json" \
    -H "X-Codeium-Csrf-Token: ${CSRF_TOKEN}" \
    -H "Connect-Protocol-Version: 1" \
    -d '{"metadata":{"ideName":"antigravity","extensionName":"antigravity","locale":"en"}}' \
    --connect-timeout 5)

if [[ -z "$QUOTA_RESPONSE" ]]; then
    echo -e "${RED}❌ Không nhận được response từ server.${NC}"
    exit 1
fi

# Parse and display using Python (available on all macOS/Linux)
python3 << EOF
import json
import sys
from datetime import datetime

try:
    data = json.loads('''$QUOTA_RESPONSE''')
except json.JSONDecodeError as e:
    print(f"\033[0;31m❌ Lỗi parse JSON: {e}\033[0m")
    sys.exit(1)

user_status = data.get('userStatus', {})
plan_status = user_status.get('planStatus', {})
plan_info = plan_status.get('planInfo', {})

# User info
name = user_status.get('name', 'N/A')
email = user_status.get('email', 'N/A')
plan_name = plan_info.get('planName', 'N/A')

print("\033[1;36m" + "═" * 50 + "\033[0m")
print(f"\033[1m👤 User:\033[0m {name}")
print(f"\033[1m📧 Email:\033[0m {email}")
print(f"\033[1m📋 Plan:\033[0m {plan_name}")
print("\033[1;36m" + "═" * 50 + "\033[0m")

# Model Quotas
model_configs = user_status.get('cascadeModelConfigData', {}).get('clientModelConfigs', [])

# Fixed order for models display
MODEL_ORDER = [
    "Gemini 3.1 Pro (High)",
    "Gemini 3.1 Pro (Low)",
    "Gemini 3 Flash",
    "Claude Sonnet 4.6 (Thinking)",
    "Claude Opus 4.6 (Thinking)",
    "GPT-OSS 120B (Medium)",
]

def get_model_sort_key(model):
    label = model.get('label', '')
    if label in MODEL_ORDER:
        return MODEL_ORDER.index(label)
    return len(MODEL_ORDER)  # Unknown models go to the end

if model_configs:
    print(f"\n\033[1m🤖 Model Quotas:\033[0m")
    print("\033[0;36m" + "─" * 50 + "\033[0m")
    
    sorted_models = sorted(model_configs, key=get_model_sort_key)
    
    for model in sorted_models:
        quota_info = model.get('quotaInfo')
        if not quota_info:
            continue
        
        label = model.get('label', 'Unknown')
        remaining = quota_info.get('remainingFraction')
        reset_time_str = quota_info.get('resetTime', '')
        
        # If no remainingFraction but has resetTime → exhausted (0%)
        # If no remainingFraction and no resetTime → unlimited
        if remaining is None and reset_time_str:
            # Exhausted - no remainingFraction but has reset time
            pct = 0
        elif remaining is not None:
            pct = remaining * 100
        else:
            # Truly unlimited - no quota info at all
            print(f"   ✓ \033[1m{label}\033[0m")
            print(f"      \033[0;32mUnlimited\033[0m")
            continue
        
        bar_filled = int(pct / 5)
        bar_empty = 20 - bar_filled
        bar = "▓" * bar_filled + "░" * bar_empty
        
        # Color based on percentage
        if pct == 0:
            color = "\033[0;31m"  # Red
            status = "❌"
        elif pct < 20:
            color = "\033[1;33m"  # Yellow
            status = "⚠️ "
        else:
            color = "\033[0;32m"  # Green
            status = "✓"
        
        # Parse reset time
        reset_info = ""
        if reset_time_str:
            try:
                reset_dt = datetime.fromisoformat(reset_time_str.replace('Z', '+00:00'))
                now = datetime.now(reset_dt.tzinfo)
                diff = reset_dt - now
                
                if diff.total_seconds() > 0:
                    hours = int(diff.total_seconds() // 3600)
                    mins = int((diff.total_seconds() % 3600) // 60)
                    if hours > 0:
                        reset_info = f" (reset: {hours}h {mins}m)"
                    else:
                        reset_info = f" (reset: {mins}m)"
                else:
                    reset_info = " (ready)"
            except:
                pass
        
        print(f"   {status} \033[1m{label}\033[0m")
        print(f"      {color}{bar}\033[0m {pct:.1f}%{reset_info}")

print("\033[1;36m" + "═" * 50 + "\033[0m")
print(f"\n\033[0;90m⏱  Checked at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\033[0m")
EOF

echo ""
