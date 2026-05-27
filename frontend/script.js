document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const uploadQueue = document.getElementById('uploadQueue');
    const matchClipButton = document.getElementById('matchClipButton');
    const trainingAnalysisButton = document.getElementById('trainingAnalysisButton');
    const uploadTasks = new Map();
    const CHUNK_SIZE = 20 * 1024 * 1024; //20MB分片

    const modeButtons = [matchClipButton, trainingAnalysisButton].filter(Boolean);

    const setModeButtonsDisabled = (disabled, activeButton, activeText) => {
        modeButtons.forEach(button => {
            button.disabled = disabled;
            if (button === activeButton && activeText) {
                button.textContent = activeText;
            }
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
                const response = await fetch(`/status/${taskId}`);
                // 处理HTTP错误（4xx/5xx）
                if (!response.ok) {
                    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                retryCount = 0; // 成功时重置重试计数器

                // 更新进度显示
                progressBar.style.width = `${result.progress}%`;
                statusDiv.classList.remove('status-error');
                statusDiv.classList.add('status-processing');

                // 处理不同状态
                switch (result.status) {
                    case 'completed':
                        statusDiv.innerHTML = '✅ 分析完成';

                        const downloadFilename = result.result; // 例如: output/uuid/timestamp/video.mp4
                        const thumbnailFilename = result.thumbnailUrl; // 例如: output/uuid/timestamp/thumbnail.jpg

                        // 只编码文件名部分，不破坏路径结构
                        function encodeFilePath(path) {
                            const parts = path.split('/');
                            return parts.map(p => encodeURIComponent(p)).join('/');
                        }

                        // 确保所有需要的数据都存在，如果不存在则提供默认值
                        const downloadUrl = downloadFilename ? `/download/${encodeFilePath(downloadFilename)}` : '#';
                        const thumbnailUrl = thumbnailFilename ? `/download/${encodeFilePath(thumbnailFilename)}` : 'favicon28.png';
                        const filename = result.filename || 'unknown.mp4';
                        const displayFilename = truncateFilename(filename, 8); // 最多显示8个字符（不含扩展名）

                        // 获取 video-list 元素
                        const videoList = document.getElementById('video-list');

                        // 创建一个 <li> 元素
                        const videoItem = document.createElement('li');
                        videoItem.className = 'video-item'; // 可选类名用于样式控制

                        // 检查是否存在相同 filename 的项
                        const existingItem = Array.from(videoList.querySelectorAll('.video-item'))
                            .find(item => item.querySelector('.download-link').textContent.trim() === `下载 ${displayFilename}`);

                        if (!existingItem) {
                            // 如果不存在，则创建并追加新的结果项
                            const videoItem = document.createElement('li');
                            videoItem.className = 'video-item';  // 添加一个类名以便于查找和样式设置
                            videoItem.innerHTML = `
                                <div class="thumbnail-container">
                                    <img src="${thumbnailUrl}" alt="Thumbnail" class="thumbnail">
                                    <div>
                                        <a href="${downloadUrl}" class="download-link" title="下载 ${filename}">下载 ${displayFilename}</a>
                                        <span class="video-duration">${result.duration} 秒</span>
                                        <span class="video-size">${(result.size/1024/1024).toFixed(2)}MB</span>
                                        <span class="video-clips">${result.clips} 片段</span>
                                    </div>
                                </div>
                            `;
                            // 追加到 <ul id="video-list">
                            videoList.appendChild(videoItem);
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
            const fileSizeLimit = 2 * 1024 * 1024 * 1024; // 1GB
            if (file.size > fileSizeLimit) {
                alert(`文件 "${file.name}, ${(file.size/(1024*1024)).toFixed(2)}MB" 大于 2GB, 无法上传!`);
                return; // 跳过该文件
            }
            // 创建任务卡片
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.innerHTML = `
                <p>${file.name} (${(file.size/1024/1024).toFixed(2)}MB)</p>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
                <div class="status">准备上传...</div>
                <button class="cancel-btn">取消</button> <!-- 添加取消按钮 -->
            `;
            uploadQueue.appendChild(taskItem);

            // 获取当前任务的DOM元素
            const progressBar = taskItem.querySelector('.progress');
            const statusDiv = taskItem.querySelector('.status');
            const cancelBtn = taskItem.querySelector('.cancel-btn'); // 获取取消按钮

            try {
                // 创建上传任务对象并存储
                const taskObj = {
                    file,
                    progress: 0,
                    element: taskItem,
                    totalChunks: 0,
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
                    cancelBtn.disabled = true; // 禁用取消按钮
                });

                // 开始分片上传流程
                statusDiv.innerHTML = '正在计算文件特征...';
                const fileMd5 = await calculateFileMD5(file); // 需要提前引入SparkMD5

                statusDiv.innerHTML = '开始分片上传...';
                const chunkCount = Math.ceil(file.size / CHUNK_SIZE);

                // 初始化上传任务
                const encodedFileName = encodeURIComponent(file.name);
                const initResponse = await fetch(`/upload/init?file_name=${encodedFileName}&file_md5=${fileMd5}`, {
                    signal: taskObj.controller.signal // 绑定中断信号
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
                            const increment = 10000 / chunkCount;
                            taskObj.progress = Math.min(taskObj.progress + increment, 10000);
                            progressBar.style.width = `${(taskObj.progress / 100).toFixed(2)}%`;
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

                                        const response = await fetch('/upload/chunk', {
                                            method: 'POST',
                                            body: chunkFormData,
                                            signal: taskObj.controller.signal
                                        })

                                        // 严格校验响应
                                        if (!response.ok || !(await response.json()).success) {
                                            throw new Error('分片上传未确认');
                                        }
                                        // 更新进度（原子操作）
                                        const increment = 10000 / chunkCount;
                                        taskObj.progress = Math.min(taskObj.progress + increment, 10000);
                                        progressBar.style.width = `${(taskObj.progress / 100).toFixed(2)}%`;
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
                const completeResponse = await fetch(`/upload/complete?file_name=${encodedFileName}&file_size=${file.size}&file_md5=${fileMd5}&mode=${mode}`).then(async response => {
                    if (!response.ok) {
                        throw new Error(`合并请求失败: ${response.status} ${response.statusText}`);
                    }
                    return safeJsonParse(response);
                });

                // 启动轮询
                // 先存储任务信息，再启动轮询
                uploadTasks.set(completeResponse.task_id, {
                    element: taskItem,
                    cancel: null // 先占位
                });

                const cancelPolling = startStatusPolling(completeResponse.task_id);
                uploadTasks.set(completeResponse.task_id, {
                        element: taskItem,
                        cancel: cancelPolling
                });
                statusDiv.innerHTML = `准备视频分析(任务ID: ${completeResponse.task_id})`;
            } catch (error) {
                if (error.message === '用户取消了上传') {
                    statusDiv.innerHTML = '❌ 上传取消';
                } else {
                    // 捕获其他错误
                    console.error(error);
                    const errorMessage = error.message || error.toString() || "未知错误";
                    progressBar.style.width = '0%'; // 重置进度条
                    statusDiv.innerHTML = `处理失败: ${errorMessage}`;
                    statusDiv.style.color = 'red';
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
            startUpload('match_clip', matchClipButton);
        });
    }

    if (trainingAnalysisButton) {
        trainingAnalysisButton.addEventListener('click', (e) => {
            e.preventDefault();
            startUpload('training_analysis', trainingAnalysisButton);
        });
    }
});
