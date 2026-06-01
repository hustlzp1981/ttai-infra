#!/bin/bash
# 重启 Express 并等待 MongoDB 连接就绪
# 位置: root@47.117.152.124:~/workspace/tt.ai/scripts/recover-express.sh

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启 Express..."
docker restart ttai-wechat-login-1

for i in $(seq 1 10); do
  sleep 3
  if docker logs ttai-wechat-login-1 --tail 5 2>&1 | grep -q "MongoDB 连接成功"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Express 恢复成功"
    exit 0
  fi
  echo "  等待就绪... ($i/10)"
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Express 启动超时"
exit 1
