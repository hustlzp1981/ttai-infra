#!/bin/bash
cd ~/workspace/tt.ai
docker-compose exec wechat-login node src/refresh-docs.js
