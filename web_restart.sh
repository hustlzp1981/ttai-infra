#!/usr/bin/env bash
set -e  # 遇到错误立即退出

# 可选：切换到脚本所在目录
cd "$(dirname "$0")"

echo "当前路径: $(pwd)"

docker-compose down web
cp ../nginx_web.conf frontend/nginx.conf
docker-compose up web
