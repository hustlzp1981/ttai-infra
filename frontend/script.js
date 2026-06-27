document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = window.TTAI_BASE_URL || '';
    const API_BASE = BASE_URL + '/api';
    const urlParams = new URLSearchParams(window.location.search);
    const loginToken = urlParams.get('token');
    const loginOpenId = urlParams.get('openid');
    if (loginToken) localStorage.setItem('token', loginToken);
    if (loginOpenId) localStorage.setItem('openid', loginOpenId);
    const form = document.getElementById('uploadForm');
    const uploadQueue = document.getElementById('uploadQueue');
    const matchClipButton = document.getElementById('matchClipButton');
    const trainingAnalysisButton = document.getElementById('trainingAnalysisButton');
    const uploadTasks = new Map();
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB 分片

    const modeButtons = [matchClipButton, trainingAnalysisButton].filter(Boolean);
    const modeLabels = {
        match_clip: '比赛回合剪辑',
        training_analysis: '训练视频分析'
    };

    const setModeButtonsDisabled = (disabled, activeButton, activeText) => {
        modeButtons.forEach(button => {
            button.disabled = disabled;
            if (button === activeButton && activeText) {
                button.textContent = activeText;
            }
        });
    };

    const setActiveModeButton = (activeButton) => {
        modeButtons.forEach(button => {
            button.classList.toggle('btn-primary', button === activeButton);
        });
    };

    if (form) {
        form.addEventListener('submit', (e) => e.preventDefault());
    }

    if (!window.retryTask) {
                window.retryTask = (taskId) => {
                    const task = uploadTasks.get(taskId);
                    if (task) {
                        task.cancel?.(); // 取消旧轮询
                        uploadTasks.set(taskId, {
                        ...task,
                        cancel: startStatusPolling(taskId)
                        });
                    }
                };

                window.cancelTask = (taskId) => {
                    const task = uploadTasks.get(taskId);
                    if (task) {
                        task.cancel?.();
                        task.element.remove();
                        uploadTasks.delete(taskId);
                    }
                };
    }

    // 生成文件唯一标识（需引入spark-md5库）
    const calculateFileMD5 = (file) => {
        return new Promise((resolve) => {
            const spark = new SparkMD5.ArrayBuffer();
            const reader = new FileReader();
            const chunks = Math.ceil(file.size / CHUNK_SIZE);
            let currentChunk = 0;

            reader.onload = function(e) {
                spark.append(e.target.result);
                currentChunk++;
                if (currentChunk < chunks) loadNextChunk();
                else resolve(spark.end());
            };

            function loadNextChunk() {
                const start = currentChunk * CHUNK_SIZE;
                const end = start + CHUNK_SIZE >= file.size ? file.size : start + CHUNK_SIZE;
                reader.readAsArrayBuffer(file.slice(start, end));
            }
            loadNextChunk();
        });
    };

    const safeJsonParse = async (response) => {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error(`响应非JSON格式: ${text.slice(0, 100)}`);
        }
    };

    const getAuthToken = () => localStorage.getItem('token') || '';

    const requireLogin = () => {
        alert('请先登录后再上传视频');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
    };

    const getOpenId = async () => {
        const cached = localStorage.getItem('openid');
        if (cached) return cached;
        const token = getAuthToken();
        if (!token) return '';
        const response = await fetch(API_BASE + '/user', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) return '';
        const data = await safeJsonParse(response);
        const openid = data && data.data && data.data.user && data.data.user.openid;
        if (openid) localStorage.setItem('openid', openid);
        return openid || '';
    };

    const resolveUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        if (path.startsWith('/')) return BASE_URL + path;
        return BASE_URL + '/' + path;
    };

    const encodeFilePath = (path) => {
        if (!path) return '';
        return path.split('/').map(part => encodeURIComponent(part)).join('/');
    };

    const resolveThumbnailUrl = (value) => {
        if (!value) return 'favicon28.png';
        if (value.startsWith('http') || value.startsWith('/')) return resolveUrl(value);
        if (value.includes('/')) return resolveUrl(value);
        return resolveUrl(`/download/${encodeFilePath(value)}`);
    };

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const formatDate = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return date.toISOString().slice(0, 10);
    };

    const modeLabelOf = (mode) => mode === 'match_clip' ? '比赛剪辑' : '训练分析';

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderVideoItem = (item) => {
        const videoList = document.getElementById('video-list');
        if (!videoList || !item) return;
        const emptyState = document.querySelector('#my-videos .empty-state');
        if (emptyState) emptyState.style.display = 'none';
        const displayName = item.filename || item.title || 'video';
        const existingItem = Array.from(videoList.querySelectorAll('.video-item'))
            .find(entry => entry.querySelector('.download-link')?.textContent?.includes(displayName));
        if (existingItem) return;

        const li = document.createElement('li');
        li.className = 'video-item';
        const thumb = resolveThumbnailUrl(item.thumbnailUrl || item.thumbnail || '');
        const duration = item.duration ? `${Math.round(item.duration)} 秒` : '';
        const size = item.size ? `${(item.size / 1024 / 1024).toFixed(2)}MB` : '';
        const clipCount = item.clipCount || (Array.isArray(item.clips) ? item.clips.length : (typeof item.clips === 'number' ? item.clips : 0));
        const clips = clipCount ? `${clipCount} 片段` : '';
        const modeLabel = modeLabelOf(item.mode);
        const title = item.title || modeLabel;
        const videoId = item.id || item._id || '';
        const score = item.scores && item.scores.overall ? ` · ${item.scores.overall}分` : '';
        const date = formatDate(item.date || item.createdAt);

        li.innerHTML = `
            <div class="thumbnail-container">
                <img src="${thumb}" alt="Thumbnail" class="thumbnail">
                <div>
                    <a href="video-detail.html?id=${encodeURIComponent(videoId)}" class="download-link" title="${escapeHtml(title)}">${escapeHtml(title)}</a>
                    <span class="video-duration">${duration}</span>
                    <span class="video-size">${size}</span>
                    <span class="video-clips">${modeLabel}${date ? ' · ' + date : ''}${clips ? ' · ' + clips : ''}${score}</span>
                </div>
            </div>
        `;
        videoList.appendChild(li);
    };

    const fetchLatestVideo = async (mode) => {
        const token = getAuthToken();
        if (!token) return null;
        try {
            const params = new URLSearchParams({ page: '1', pageSize: '1' });
            if (mode) params.set('mode', mode);
            const response = await fetch(`${API_BASE}/videos/list?${params.toString()}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) return null;
            const payload = await safeJsonParse(response);
            const data = payload && payload.data ? payload.data : payload;
            const items = data && data.items ? data.items : [];
            return items[0] || null;
        } catch (err) {
            console.warn('fetchLatestVideo failed', err);
            return null;
        }
    };

    const loadRecentVideos = async () => {
        const token = getAuthToken();
        const videoList = document.getElementById('video-list');
        const emptyState = document.querySelector('#my-videos .empty-state');
        if (!token) {
            if (emptyState) {
                emptyState.textContent = '请先登录，登录后这里会显示最近分析结果。';
                emptyState.style.display = 'block';
            }
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/videos/list?page=1&pageSize=4`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) throw new Error('videos fetch failed');
            const payload = await safeJsonParse(response);
            const data = payload && payload.data ? payload.data : payload;
            const items = data && Array.isArray(data.items) ? data.items : [];
            if (videoList) videoList.innerHTML = '';
            items.forEach(renderVideoItem);

            if (emptyState) {
                emptyState.textContent = items.length ? '' : '暂无视频记录，上传第一个视频即可在这里看到分析结果。';
                emptyState.style.display = items.length ? 'none' : 'block';
            }
        } catch (err) {
            console.warn('loadRecentVideos failed', err);
            if (emptyState) {
                emptyState.textContent = '最近视频加载失败，请稍后刷新。';
                emptyState.style.display = 'block';
            }
        }
    };

    const renderTrainingLogs = (logs) => {
        const list = document.getElementById('recent-training-list');
        const empty = document.getElementById('recent-training-empty');
        if (!list) return;
        list.innerHTML = '';

        if (!logs.length) {
            if (empty) empty.style.display = 'block';
            return;
        }

        if (empty) empty.style.display = 'none';
        logs.slice(0, 5).forEach((entry) => {
            const tags = Array.isArray(entry.tags) ? entry.tags.slice(0, 3) : [];
            const card = document.createElement('div');
            card.className = 'recent-log-card';
            card.innerHTML = `
                <div class="recent-log-meta">
                    <span>${escapeHtml(formatDate(entry.date || entry.createdAt) || '未记录日期')}</span>
                    <span>${Number(entry.duration || 0) || '--'} 分钟</span>
                </div>
                <strong>${escapeHtml(entry.summary || entry.rawInput || '训练记录')}</strong>
                <div class="recent-log-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            `;
            list.appendChild(card);
        });
    };

    const loadRecentTrainingLogs = async () => {
        const token = getAuthToken();
        const empty = document.getElementById('recent-training-empty');
        if (!token) {
            if (empty) {
                empty.textContent = '请先登录，登录后这里会显示最近训练日志。';
                empty.style.display = 'block';
            }
            setText('home-log-total', '--');
            setText('home-latest-log', '--');
            return;
        }

        try {
            const userId = await getOpenId();
            if (!userId) throw new Error('missing user');
            const response = await fetch(`${API_BASE}/chat/training-log?userId=${encodeURIComponent(userId)}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) throw new Error('training log fetch failed');
            const payload = await safeJsonParse(response);
            const entries = (payload && payload.data && payload.data.entries) || (payload && payload.data) || [];
            const logs = (entries || []).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
            renderTrainingLogs(logs);
        } catch (err) {
            console.warn('loadRecentTrainingLogs failed', err);
            if (empty) {
                empty.textContent = '最近训练加载失败，请稍后刷新。';
                empty.style.display = 'block';
            }
        }
    };

    const authHeaders = () => {
        const token = getAuthToken();
        return token ? { 'Authorization': 'Bearer ' + token } : {};
    };

    const fetchApiData = async (url) => {
        const response = await fetch(url, { headers: authHeaders() });
        if (!response.ok) throw new Error('request failed: ' + response.status);
        const payload = await safeJsonParse(response);
        if (payload && payload.code && payload.code !== 0) {
            throw new Error(payload.message || 'request failed');
        }
        return payload && payload.data ? payload.data : payload;
    };

    const loadTrainingStatsSummary = async () => {
        if (!getAuthToken()) {
            setText('home-summary-note', '登录后自动加载训练统计、最近视频和训练记录。');
            return;
        }
        try {
            const stats = await fetchApiData(`${API_BASE}/stats?days=30`);
            const training = stats.training || {};
            const ai = stats.ai || stats || {};
            const thisMonth = training.thisMonth || {};
            const thisWeek = training.thisWeek || {};
            const weakPoints = ai.weakPoints || stats.weakPoints || [];
            setText('home-video-total', `${Number(thisMonth.days || 0)} 天`);
            setText('home-log-total', ai.avgScore ? String(ai.avgScore) : '--');
            setText('home-latest-mode', `${Number(thisWeek.days || 0)} 天`);
            setText('home-latest-log', weakPoints.length ? weakPoints.slice(0, 2).join('、') : '稳定');
            setText('home-summary-note', '训练统计、最近视频和训练记录已同步。');
        } catch (err) {
            console.warn('loadTrainingStatsSummary failed', err);
            setText('home-summary-note', '训练统计加载失败，最近视频和训练日志仍可查看。');
        }
    };

    const clubIdOf = (club) => club && (club.id || club._id || club.clubId || club.slug || '');

    const loadClubHomeSummary = async () => {
        const section = document.getElementById('club-home-summary');
        if (!section || !getAuthToken()) return;
        try {
            const profile = await fetchApiData(`${API_BASE}/club-admin/profile`);
            const info = (profile && profile.clubAdmin) || {};
            const clubs = Array.isArray(info.clubs)
                ? info.clubs
                : (Array.isArray(profile && profile.clubs) ? profile.clubs : []);
            const isAdmin = info.isAdmin === true || profile.isClubAdmin === true || profile.isAdmin === true || clubs.length > 0;
            if (!isAdmin || !clubs.length) return;

            const defaultClubId = info.defaultClubId || profile.defaultClubId || clubIdOf(clubs[0]);
            const club = clubs.find((item) => clubIdOf(item) === defaultClubId) || clubs[0];
            const clubId = clubIdOf(club);
            if (!clubId) return;

            const [overviewResult, pendingResult] = await Promise.all([
                fetchApiData(`${API_BASE}/club-admin/overview?clubId=${encodeURIComponent(clubId)}`).catch(() => ({})),
                fetchApiData(`${API_BASE}/club-admin/edu/pending-counts?clubId=${encodeURIComponent(clubId)}`).catch(() => ({}))
            ]);
            const overview = overviewResult.overview || overviewResult || {};
            const counts = pendingResult.counts || pendingResult || {};
            const clubName = club.name || club.clubName || overview.clubName || '俱乐部';

            setText('club-summary-title', `${clubName} 管理摘要`);
            setText('club-summary-subtitle', '查看待处理事项，快速进入俱乐部管理。');
            setText('club-pending-bookings', String(Number(counts.pendingBookings || overview.pendingBookings || 0)));
            setText('club-pending-attendance', String(Number(counts.pendingAttendance || overview.pendingAttendance || overview.pendingSessions || 0)));
            setText('club-new-leads', String(Number(counts.newLeads || overview.newLeads || 0)));
            setText('club-pending-expiry', String(Number(counts.pendingExpiry || overview.pendingExpiry || 0)));
            section.hidden = false;
        } catch (err) {
            if (section) section.hidden = true;
        }
    };

    const loadHomeDashboard = () => {
        loadTrainingStatsSummary();
        loadRecentVideos();
        loadRecentTrainingLogs();
        loadClubHomeSummary();
    };

    const sliceFile = (file) => {
        const chunks = [];
        let offset = 0;

        // 处理Safari浏览器的slice方法兼容性
        const slice = file.slice || file.webkitSlice || file.mozSlice;

        while (offset < file.size) {
            const end = Math.min(offset + CHUNK_SIZE, file.size);
            const chunkBlob = slice.call(file, offset, end);

            chunks.push({
                blob: chunkBlob,
                index: Number( Math.floor(offset / CHUNK_SIZE) ),
                start: offset,
                end: end
            });

            offset = end;
        }

        return chunks;
    }

    const formatBytes = (bytes) => {
        if (!Number.isFinite(bytes)) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        return `${size.toFixed(size >= 100 ? 0 : 2)} ${units[unitIndex]}`;
    };

    const updateUploadProgress = (taskObj, progressBar, progressText, percentText) => {
        const total = taskObj.totalChunks || 0;
        const uploaded = taskObj.uploadedChunks || 0;
        if (!total) return;
        const percent = Math.min(100, Math.round((uploaded / total) * 100));
        progressBar.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;
        if (progressText) progressText.textContent = `已上传 ${uploaded}/${total} 分片`;
    };

    function truncateFilename(filename, maxLength = 8) {
        // 分离文件名和扩展名
        const lastDotIndex = filename.lastIndexOf('.');
        const name = lastDotIndex === -1 ? filename : filename.slice(0, lastDotIndex);
        const ext = lastDotIndex === -1 ? '' : filename.slice(lastDotIndex);

        // 截断文件名部分
        if (name.length > maxLength) {
            return name.slice(0, maxLength) + '~' + ext;
        }

        return name + ext;
    }

    const startStatusPolling = (taskId) => {
        let retryCount = 0;
        const maxRetries = 5;
        let isCanceled = false;

        // 获取当前任务的DOM元素
        const taskItem = uploadTasks.get(taskId)?.element;
        if (!taskItem) return;

        const progressBar = taskItem.querySelector('.progress');
        progressBar.style.width = '0%'; // ✅ 初始化进度
        const statusDiv = taskItem.querySelector('.status');

        //const resultDiv = document.createElement('div');
        //document.getElementById('video-list').appendChild(resultDiv);

        // 清理定时器
        let pollTimer = null;
        const cleanup = () => {
            if (pollTimer) clearTimeout(pollTimer);
            uploadTasks.delete(taskId);
        };

        // 核心轮询逻辑
        const checkStatus = async () => {
            if (isCanceled) return;

            try {
                const response = await fetch(API_BASE + `/upload-local/status/${taskId}`, {
                    headers: { 'Authorization': 'Bearer ' + getAuthToken() }
                });
                // 处理HTTP错误（4xx/5xx）
                if (!response.ok) {
                    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
                }

                const payload = await safeJsonParse(response);
                const result = payload && payload.data ? payload.data : payload;
                retryCount = 0; // 成功时重置重试计数器

                // 更新进度显示
                progressBar.style.width = `${result.progress}%`;
                statusDiv.classList.remove('status-error');
                statusDiv.classList.add('status-processing');

                // 处理不同状态
                switch (result.status) {
                    case 'completed':
                        statusDiv.innerHTML = '✅ 分析完成';

                        const downloadFilename = result.result || '';
                        const taskKey = result.taskId || taskId;
                        const taskContext = uploadTasks.get(taskId) || {};
                        const taskMode = result.mode || taskContext.mode || 'match_clip';

                        const fallbackVideo = taskKey ? `${API_BASE}/download-media/${taskKey}/merged.mp4` : '';
                        const downloadUrl = result.videoUrl
                            ? resolveUrl(result.videoUrl)
                            : (downloadFilename ? resolveUrl(`/download/${encodeFilePath(downloadFilename)}`) : fallbackVideo);
                        const latestVideo = await fetchLatestVideo(taskMode);
                        if (latestVideo) {
                            renderVideoItem(latestVideo);
                        } else {
                            renderVideoItem({
                                id: taskKey,
                                title: taskMode === 'match_clip' ? '比赛剪辑' : '训练分析',
                                mode: taskMode,
                                thumbnailUrl: result.thumbnailUrl || result.thumbnail || '',
                                duration: result.duration,
                                size: result.size,
                                clipCount: Array.isArray(result.clips) ? result.clips.length : (typeof result.clips === 'number' ? result.clips : result.clipCount || 0),
                                videoUrl: downloadUrl
                            });
                        }
                        // 如果已存在相同文件名的项，则忽略
                        cleanup();
                        break;
                    case 'failed':
                        throw new Error(result.message || '视频处理失败');
                    default:
                        statusDiv.innerHTML = `🔄 处理中（${Math.round(result.progress)}%）`;
                        pollTimer = setTimeout(checkStatus, 1500);
                }
            } catch (error) {
                statusDiv.classList.add('status-error');

                // 网络错误自动重试
                if (error.message.includes('Failed to fetch') && retryCount < maxRetries) {
                    retryCount++;
                    statusDiv.innerHTML = `🌐 网络不稳定（${retryCount}/${maxRetries} 次重试中...）`;
                    pollTimer = setTimeout(checkStatus, Math.pow(2, retryCount) * 1000);
                    return;
                }

                // 最终错误处理
                statusDiv.innerHTML = `❌ 错误: ${error.message.replace(/^Error: /, '')}`;
                cleanup();
            }
        };

        // 初始化轮询
        checkStatus();

        // 返回取消方法
        return () => {
            isCanceled = true;
            cleanup();
        };
    };

    const startUpload = async (mode, activeButton) => {
        const originalTexts = new Map(modeButtons.map(button => [button, button.textContent]));
        setModeButtonsDisabled(true, activeButton, '上传中...');

        const fileInput = form.querySelector('input[type="file"]');
        if (!fileInput) {
            console.error('错误：未找到文件上传输入框');
            return;
        }

        const token = getAuthToken();
        if (!token) {
            requireLogin();
            setModeButtonsDisabled(false);
            return;
        }

        const files = fileInput.files;
        if (files.length === 0) {
            alert('请至少选择一个视频文件');
            setModeButtonsDisabled(false);
            originalTexts.forEach((text, button) => {
                button.textContent = text;
            });
            return;
        }

        // 检查文件数量是否超过限制，暂时限制2个
        if (files.length > 2) {
            alert('普通用户只能选择 2 个文件！');
            fileInput.value = ''; // 清空文件输入框
            return;
        }

        uploadQueue.innerHTML = '';

        // 为每个文件创建上传任务
        Array.from(files).forEach(async (file) => {
            // 检查文件大小是否超过 1GB
            const fileSizeLimit = 2 * 1024 * 1024 * 1024;
            if (file.size > fileSizeLimit) {
                alert(`文件 "${file.name}, ${(file.size/(1024*1024)).toFixed(2)}MB" 大于 2GB, 无法上传!`);
                return; // 跳过该文件
            }
            // 创建任务卡片
                        const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.innerHTML = `
                                <div class="task-header">
                                    <div>
                                        <p class="task-name">${file.name}</p>
                                        <p class="task-meta">${formatBytes(file.size)} · ${modeLabels[mode] || '视频分析'}</p>
                                    </div>
                                    <span class="task-percent">0%</span>
                                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
                                <div class="status-row">
                                    <div class="status">准备上传...</div>
                                    <div class="progress-text">等待处理</div>
                                </div>
                                <div class="task-actions">
                                    <button class="cancel-btn">取消</button>
                                </div>
            `;
            uploadQueue.appendChild(taskItem);

            // 获取当前任务的DOM元素
            const progressBar = taskItem.querySelector('.progress');
            const statusDiv = taskItem.querySelector('.status');
            const progressText = taskItem.querySelector('.progress-text');
            const percentText = taskItem.querySelector('.task-percent');
            const cancelBtn = taskItem.querySelector('.cancel-btn'); // 获取取消按钮

            try {
                // 创建上传任务对象并存储
                const taskObj = {
                    file,
                    progress: 0,
                    element: taskItem,
                    totalChunks: 0,
                    uploadedChunks: 0,
                    failedChunks: [],
                    controller: new AbortController() // 添加中断控制
                };
                uploadTasks.set(file.name, taskObj);

                const pendingQueue = []; // 待上传队列

                // 绑定取消按钮事件
                cancelBtn.addEventListener('click', () => {
                    isStopped = true; // 新增停止标志
                    pendingQueue.length = 0; // 清空待上传队列
                    taskObj.controller.abort('用户取消了上传'); // 中断上传
                    statusDiv.innerHTML = '❌ 上传取消';
                    progressBar.style.width = '0%'; // 重置进度条
                    if (progressText) progressText.textContent = '已取消';
                    if (percentText) percentText.textContent = '0%';
                    cancelBtn.disabled = true; // 禁用取消按钮
                });

                // 开始分片上传流程
                statusDiv.innerHTML = '正在计算文件特征...';
                if (progressText) progressText.textContent = '计算 MD5';
                const fileMd5 = await calculateFileMD5(file);
                const openid = await getOpenId();
                if (!openid) {
                    requireLogin();
                    throw new Error('缺少用户身份');
                }

                statusDiv.innerHTML = '开始分片上传...';
                if (progressText) progressText.textContent = '准备分片上传';
                const chunkCount = Math.ceil(file.size / CHUNK_SIZE);

                // 初始化上传任务
                const encodedFileName = encodeURIComponent(file.name);
                const initResponse = await fetch(`${API_BASE}/upload-local/init?file_name=${encodedFileName}&file_md5=${fileMd5}&openid=${encodeURIComponent(openid)}`, {
                    signal: taskObj.controller.signal,
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!initResponse.ok) {
                    throw new Error(`初始化失败: ${initResponse.status} ${initResponse.statusText}`);
                }
                const initData = await initResponse.json();

                // 如果文件已经完整存在，直接跳到合并阶段
                if (initData.status === "completed") {
                    statusDiv.innerHTML = '文件已存在';
                } else {
                    const { uploaded } = initData; // 正确解构 uploaded
                    if (!Array.isArray(uploaded)) {
                        throw new Error("后端返回的 uploaded 数据格式不正确");
                    }

                    // 切割文件
                    const chunks = sliceFile(file);
                    taskObj.totalChunks = chunks.length;
                    // 生成分片上传任务
                    chunks.forEach(chunk => {
                        if (uploaded.map(Number).includes(chunk.index)) {
                            taskObj.uploadedChunks += 1;
                            updateUploadProgress(taskObj, progressBar, progressText, percentText);
                            return;
                        }

                        (currentChunk => {
                            // 深拷贝必要数据
                            const taskInfo = {
                                blob: currentChunk.blob,
                                index: currentChunk.index,
                                blobSize: currentChunk.blob.size,
                                fileName: taskObj.file.name,
                            };

                            // 上传分片
                            const task = async () => {
                                for (let retry = 0; retry < 3; retry++) {
                                    try {
                                        const chunkFormData = new FormData()
                                        chunkFormData.append('file', taskInfo.blob)
                                        chunkFormData.append('chunk_index', taskInfo.index.toString())
                                        chunkFormData.append('file_md5', fileMd5)

                                        const chunk_md5 = await calculateFileMD5(taskInfo.blob)
                                        chunkFormData.append('chunk_md5', chunk_md5)

                                        const response = await fetch(API_BASE + '/upload-local/chunk', {
                                            method: 'POST',
                                            body: chunkFormData,
                                            signal: taskObj.controller.signal,
                                            headers: { 'Authorization': 'Bearer ' + token }
                                        })

                                        // 严格校验响应
                                        if (!response.ok || !(await response.json()).success) {
                                            throw new Error('分片上传未确认');
                                        }
                                        // 更新进度（原子操作）
                                        taskObj.uploadedChunks += 1;
                                        updateUploadProgress(taskObj, progressBar, progressText, percentText);
                                        break;
                                    } catch (error) {
                                        if (error.toString() === '用户取消了上传' || error.message === 'Fetch is aborted') {
                                            taskInfo.blob = null; // 释放内存
                                            isStopped = true;
                                            throw new Error('用户取消了上传');
                                        } else if (error.toString() === '分片上传未确认') {
                                            if (retry === 2) {
                                                taskInfo.blob = null; // 释放内存
                                                isStopped = true;
                                                console.warn(`分片 #${taskInfo.index} 永久失败`);
                                                throw new Error("上传失败");
                                            }
                                            console.warn(`分片 #${taskInfo.index} 上传${retry+1}/3 失败，重试中...`);
                                            await new Promise(res => setTimeout(res, 2000 ** retry));
                                        } else {
                                            taskInfo.blob = null; // 释放内存
                                            throw error;
                                        }
                                    }
                                }
                                taskInfo.blob = null; // 释放内存
                            };

                            // 加入待上传队列
                            pendingQueue.push({
                                task: () => task(),
                                context: taskInfo
                            });
                        })(chunk);
                    });

                    // 增强版并发控制器
                    let activeConnections = 0;
                    const MAX_CONCURRENT = 3;
                    let isStopped = false; // 用于取消操作

                    const processNext = async () => {
                        if (isStopped || activeConnections >= MAX_CONCURRENT || !pendingQueue.length) return;

                        const { task } = pendingQueue.shift();
                        activeConnections++;

                        try {
                            await task();
                        } catch (error) {
                            throw error;
                        } finally {
                            activeConnections--;
                            if (!isStopped) {
                                processNext(); // 递归处理下一个
                            }
                        }
                    };

                    const runUpload = () => {
                        return new Promise((resolve, reject) => {
                            let fatalError = null;
                            const checkComplete = () => {
                                if (isStopped) {
                                    fatalError = fatalError || new Error('上传失败');
                                    reject(fatalError);
                                    return;
                                }

                                if (fatalError) {
                                    // 发现致命错误立即终止
                                    reject(fatalError);
                                    return;
                                }
                                if (pendingQueue.length === 0 && activeConnections === 0) {
                                    resolve();
                                } else {
                                    // 动态补充并发（应对递归未覆盖的情况）
                                    if (activeConnections < MAX_CONCURRENT) {
                                        processNext().catch(err => {
                                                fatalError = err; // 记录第一个致命错误
                                            });
                                    }
                                    setTimeout(checkComplete, 50);
                                }
                            };

                            // 启动初始并发
                            const startConcurrent = () => {
                                Array.from({ length: Math.min(MAX_CONCURRENT, pendingQueue.length) }).forEach(() => {
                                    processNext().catch(err => {
                                                fatalError = err; // 记录第一个致命错误
                                            });
                                });
                            };
                            startConcurrent(); // 首次触发
                            checkComplete();
                        });
                    };

                    try {
                        await runUpload();
                    } catch (error) {
                        throw error;
                    }

                    // 合并分片并获取任务ID
                    statusDiv.innerHTML = '正在合并文件...';
                    cancelBtn.disabled = true; // 禁用取消按钮
                }
                //progressBar.style.width = '100%'; // 直接设置为上传完成状态
                cancelBtn.remove(); // 移除取消按钮
                // 上传完成，进入处理阶段
                const completeResponse = await fetch(API_BASE + '/upload-local/complete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        file_name: file.name,
                        file_md5: fileMd5,
                        file_size: file.size,
                        mode: mode,
                        openid: openid
                    })
                }).then(async response => {
                    if (!response.ok) {
                        throw new Error(`合并请求失败: ${response.status} ${response.statusText}`);
                    }
                    return safeJsonParse(response);
                });

                // 启动轮询
                // 先存储任务信息，再启动轮询
                const completeData = completeResponse && completeResponse.data ? completeResponse.data : completeResponse;
                const newTaskId = completeData.taskId || completeData.task_id;
                uploadTasks.set(newTaskId, {
                    element: taskItem,
                    cancel: null, // 先占位
                    mode: mode
                });

                const cancelPolling = startStatusPolling(newTaskId);
                uploadTasks.set(newTaskId, {
                        element: taskItem,
                    cancel: cancelPolling,
                    mode: mode
                });
                statusDiv.innerHTML = `准备视频分析(任务ID: ${newTaskId})`;
                if (progressText) progressText.textContent = '等待分析结果';
            } catch (error) {
                if (error.message === '用户取消了上传') {
                    statusDiv.innerHTML = '❌ 上传取消';
                    if (progressText) progressText.textContent = '已取消';
                } else {
                    // 捕获其他错误
                    console.error(error);
                    const errorMessage = error.message || error.toString() || "未知错误";
                    progressBar.style.width = '0%'; // 重置进度条
                    statusDiv.innerHTML = `处理失败: ${errorMessage}`;
                    statusDiv.style.color = 'red';
                    if (progressText) progressText.textContent = '上传失败';
                    if (percentText) percentText.textContent = '0%';
                }
            }
        });

        // 重置按钮状态（注意：这里需要等待所有上传完成）
        setModeButtonsDisabled(false);
        originalTexts.forEach((text, button) => {
            button.textContent = text;
        });
    };

    if (matchClipButton) {
        matchClipButton.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveModeButton(matchClipButton);
            startUpload('match_clip', matchClipButton);
        });
    }

    if (trainingAnalysisButton) {
        trainingAnalysisButton.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveModeButton(trainingAnalysisButton);
            startUpload('training_analysis', trainingAnalysisButton);
        });
    }

    loadHomeDashboard();
});
