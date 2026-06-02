#!/bin/bash
set -euo pipefail

usage() {
    echo "用法: $0 <M.D> <目录>  (顺序不限)"
    echo "示例: $0 5.1 ./uploads"
    echo "示例: $0 ./uploads 5.1"
    echo "说明: 删除指定日期及之前修改的所有文件，空目录自动清理"
    exit 1
}

ARG1="${1:-}"
ARG2="${2:-}"
[ -z "$ARG1" ] && usage

DATE_INPUT=""
TARGET_DIR=""

if [[ "$ARG1" =~ ^[0-9]{1,2}\.[0-9]{1,2}$ ]]; then
    DATE_INPUT="$ARG1"
    TARGET_DIR="${ARG2:-}"
elif [[ "$ARG2" =~ ^[0-9]{1,2}\.[0-9]{1,2}$ ]]; then
    DATE_INPUT="$ARG2"
    TARGET_DIR="$ARG1"
else
    if [ -z "$ARG2" ]; then
        echo "错误: 缺少参数，请同时提供日期和目录"
        usage
    fi
    echo "错误: 日期格式请使用 M.D (如 5.1, 5.28)"
    usage
fi

[ -z "$TARGET_DIR" ] && usage

MONTH=$(printf "%02d" "$(echo "$DATE_INPUT" | cut -d. -f1)")
DAY=$(printf "%02d" "$(echo "$DATE_INPUT" | cut -d. -f2)")

CUTOFF_DATE="$(date +%Y)-${MONTH}-${DAY}"

ABS_DIR=$(realpath "$TARGET_DIR" 2>/dev/null || readlink -f "$TARGET_DIR" 2>/dev/null)
if [ ! -d "$ABS_DIR" ]; then
    echo "错误: 目录不存在: $TARGET_DIR"
    exit 1
fi

echo "========== 清理预览 =========="
echo "截止日期: $CUTOFF_DATE (含当天)"
echo "目标目录: $ABS_DIR"
echo "=============================="

FILE_LIST=$(find "$ABS_DIR" -type f ! -newermt "${CUTOFF_DATE} 23:59:59" -print 2>/dev/null)
FILE_COUNT=$(echo "$FILE_LIST" | grep -c . || true)

if [ -z "$FILE_LIST" ]; then
    echo "没有需要清理的文件。"
    exit 0
fi

echo ""
echo "共 $FILE_COUNT 个文件将被删除:"
echo "$FILE_LIST" | head -100
if [ "$FILE_COUNT" -gt 100 ]; then
    echo "... (仅显示前100个，共 $FILE_COUNT 个文件)"
fi

TOTAL_SIZE=$(echo "$FILE_LIST" | xargs -d '\n' stat -c '%s' 2>/dev/null | awk '{s+=$1} END {print s}')
echo ""
echo "释放空间: $(numfmt --to=iec $TOTAL_SIZE 2>/dev/null || echo "$TOTAL_SIZE bytes")"

echo ""
read -r -p "确认删除以上文件? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "已取消"
    exit 0
fi

echo "$FILE_LIST" | xargs -d '\n' rm -f
find "$ABS_DIR" -type d -empty -delete 2>/dev/null || true
echo "完成。"
