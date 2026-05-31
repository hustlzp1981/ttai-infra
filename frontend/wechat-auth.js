// wechat-auth.js
class WeChatAuth {
    constructor(options = {}) {
        this.sessionId = this.generateSessionId();
        this.ws = null;
        this.qrCodeRefreshInterval = options.qrCodeRefreshInterval || 30000;
        this.qrCodeEndpoint = options.qrCodeEndpoint || '/api/generate-qrcode';
        this.websocketUrl = options.websocketUrl || 'wss://www.ttcut.com/ws';
        this.redirectUrl = options.redirectUrl || 'index.html';
        this.qrCodeElementId = options.qrCodeElementId || 'qrcode';
    }

    // 生成会话ID
    generateSessionId() {
        return SparkMD5.hash(uuid.v4());
    }

    // 初始化WebSocket
    initWebSocket() {
        this.ws = new WebSocket(`${this.websocketUrl}?sessionId=${this.sessionId}`);

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'auth_success') {
                    console.log('身份验证成功, 收到token:', data.token);
                    this.authToken = data.token;
                    localStorage.setItem('token', data.token);
                    
                    // 更新UI显示登录成功
                    this.showAuthSuccessUI(data.user);
                    
                    // 3秒后跳转
                    setTimeout(() => {
                        this.ws.close();
                        window.location.href = this.redirectUrl;
                    }, 3000);
                }
            } catch (e) {
                console.error('解析消息错误:', e);
            }
        };

        this.ws.onclose = () => console.log('WebSocket连接关闭');
    }

    // 显示登录成功UI（保持图片中的简洁风格）
    showAuthSuccessUI(user) {
        const qrcodeContainer = document.getElementById('qrcode-container');
        if (qrcodeContainer) {
            qrcodeContainer.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="color: #07C160; font-size: 24px;">✓</div>
                    <p style="margin: 10px 0; font-size: 16px;">登录成功</p>
                    ${user.avatarUrl ? `
                        <img src="${user.avatarUrl}" 
                            style="width: 50px; height: 50px; border-radius: 50%; margin: 10px auto;">
                        <p>${user.nickname || ''}</p>
                    ` : ''}
                    <p style="color: #888; font-size: 14px;">正在跳转...</p>
                </div>
            `;
        }
    }

    // 获取小程序码
    async fetchQRCode() {
        try {
            const response = await fetch(this.qrCodeEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId: this.sessionId })
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const blob = await response.blob();
            if (blob.type !== 'image/png') {
                console.warn('Unexpected MIME type:', blob.type);
            }

            const imageUrl = URL.createObjectURL(blob);
            console.log('Generated QR Code URL:', imageUrl);
            const imgElement = document.getElementById(this.qrCodeElementId);
            
            if (!imgElement) {
                throw new Error(`No element with id "${this.qrCodeElementId}" found.`);
            }

                imgElement.src = imageUrl;
                imgElement.onerror = () => {
                    imgElement.src = 'images/main.png';
                    imgElement.alt = '本地开发跳过二维码登录';
                };

            imgElement.onload = () => {
                console.log('QR Code image loaded successfully.');
            };

            imgElement.onerror = () => {
                console.error('Failed to load QR Code image.');
            };
        } catch (error) {
            console.error('Failed to fetch QR Code:', error);
        }
    }

    // 初始化
    init() {
        console.log('WeChatAuth initialized with sessionId:', this.sessionId);
        this.fetchQRCode();
        this.initWebSocket();
        setInterval(() => this.fetchQRCode(), this.qrCodeRefreshInterval);
    }
}