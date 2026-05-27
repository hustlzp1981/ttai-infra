mempool.py
POOL_SIZE = BATCH_LIST_SIZE * 6  # 预先分配的内存块数量48
# 37.5MB * 48 = 1800MB

config.py
USE_GPU = True  # 是否使用GPU
LOG_LEVEL = logging.DEBUG  # 日志级别

docker-compose.ymal
gpu_workers --concurrency=4
video_workers --concurrency=2
backend:
    image: ttai-ok  # 运行后端代码
celery:
    image: ttai-celery  # 运行celery任务队列
            安装了：sudo apt update
                  sudo apt install intel-opencl-icd clinfo
            验证 GPU 是否可用，在宿主机和容器内运行以下命令，测试 GPU 是否被 OpenCL 识别：
            clinfo
            如果 GPU 可用，你会看到类似以下输出：
            Number of platforms: 1
            Platform Name: Intel(R) OpenCL HD Graphics

设置大页内存：
echo 900 | sudo tee /proc/sys/vm/nr_hugepages

TODO LIST
1） 开启检测还是有问题，如果player一开始就站桌子前面准备发球，这个时候的检测状态不对，导致前面几个rallies会丢掉

2）output的video命名还是应该已md5来命名 done  output/md5/timestamp/videoname_output.mp4

3）输出剪辑视频是，开启多进程加速 done

4）对每个视频的管理，input， output， rallies的管理，数据库  done with redis currently

5）已经进入视频分析中的时候，是没法取消的

6）status request 502 报错以后要尽快继续

7) safari上传文件时，停留在文件已存在，无法切入到视频分析中的界面，但实际上已经在分析了。

Pose ONNX Export
- Use this utility to export YOLOv8 pose models to ONNX for GPU inference:
    - python app/utils/export_pose_onnx.py --model yolov8n-pose.pt --out yolov8n-pose.onnx --imgsz 640 --opset 17 --nms
- Then set env:
    - POSE_BACKEND=onnx
    - POSE_YOLO_ONNX_MODEL=yolov8n-pose.onnx
    - POSE_YOLO_ONNX_USE_TRT=true
