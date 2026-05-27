#!/usr/bin/env bash
set -e
cd /root/workspace/tt.ai

echo '[renew_cert] 停止 web 释放 80 端口...'
docker-compose stop web

echo '[renew_cert] 确保 80 端口无残留进程...'
sudo fuser -k 80/tcp 2>/dev/null || true
sleep 2

echo '[renew_cert] 执行证书续期...'
certbot renew --force-renewal

echo '[renew_cert] 释放 certbot 占用的 80 端口...'
sudo fuser -k 80/tcp 2>/dev/null || true
sleep 2

echo '[renew_cert] 验证新证书有效期...'
openssl x509 -in /etc/letsencrypt/live/www.ttcut.com/fullchain.pem -noout -dates

echo '[renew_cert] 启动 web 容器...'
docker-compose up -d web

sleep 3
echo '[renew_cert] 重载 nginx...'
docker exec ttai-web-1 nginx -s reload 2>/dev/null || true

echo '[renew_cert] 完成'
