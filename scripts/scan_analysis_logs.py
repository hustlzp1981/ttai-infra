#!/usr/bin/env python3
"""
TTAI 日志扫描 — 从 dev-backend / decoder / Express 日志中提取视频分析记录
用法:
  python3 scan_analysis_logs.py                      # 扫描过去 24h
  python3 scan_analysis_logs.py --lookback 30m       # 最近 30 分钟
  python3 scan_analysis_logs.py --lookback 2h        # 最近 2 小时
  python3 scan_analysis_logs.py --since "2026-06-07" # 指定起始日期
  python3 scan_analysis_logs.py --dry-run            # 只打印不写文件

输出:
  logs/daily/YYYY-MM-DD.csv       # 每日分析记录 (按 md5 去重)
  logs/alerts/YYYY-MM-DD.log      # 异常告警 (含 webhook)

依赖: 仅 Python 3 标准库
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from rca_engine import run_rca
from trend_engine import update_daily_trend, update_alert_trend
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# ── 配置 ──────────────────────────────────────────────────────────────
LOG_DIR = Path("logs")
DAILY_DIR = LOG_DIR / "daily"
ALERT_DIR = LOG_DIR / "alerts"
DAILY_DIR.mkdir(parents=True, exist_ok=True)
ALERT_DIR.mkdir(parents=True, exist_ok=True)

SENTINEL_PATH = LOG_DIR / ".alert_sentinel.json"
SENTINEL_TTL = timedelta(hours=24)

WEBHOOK_URL = os.environ.get("TTAI_ALERT_WEBHOOK", "")
SSH_EXPRESS = os.environ.get("TTAI_SSH_EXPRESS", "express-node")
EXPRESS_CONTAINERS = ["ttai-wechat-login-1", "ttai-wechat-1", "wechat-login-1"]

THRESHOLDS = {
    "warn_max_processing_minutes": 30,
}


# ── 日志采集 ──────────────────────────────────────────────────────────


def docker_logs(container: str, since: str, tail: int = 100000) -> str:
    try:
        r = subprocess.run(
            ["docker", "logs", container, "--since", since, "--tail", str(tail)],
            capture_output=True, text=True, timeout=180,
        )
        return r.stdout + "\n" + r.stderr
    except Exception as e:
        print(f"  [!] docker logs {container}: {e}", file=sys.stderr)
        return ""


def remote_docker_logs(host: str, container: str, since: str, tail: int = 50000) -> str:
    if not host:
        return ""
    cmd = [
        "ssh", host,
        "-o", "ConnectTimeout=15",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=no",
        "--",
        "docker", "logs", container,
        "--since", since,
        "--tail", str(tail),
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return r.stdout
    except Exception as e:
        print(f"  [!] ssh {host} docker logs {container}: {e}", file=sys.stderr)
        return ""


# ── FastAPI 后端日志解析 ──────────────────────────────────────────────

TS_PREFIX = re.compile(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")


def _ts(line: str) -> str:
    m = TS_PREFIX.match(line)
    return m.group(1) if m else ""


def _pyobj_to_json(text: str) -> str:
    s = text
    s = s.replace("'", '"')
    s = s.replace(": True", ": true").replace(": False", ": false").replace(": None", ": null")
    s = s.replace(", True", ", true").replace(", False", ", false").replace(", None", ", null")
    s = s.replace("[True", "[true").replace("[False", "[false").replace("[None", "[null")
    s = s.replace(" True}", " true}").replace(" False}", " false}").replace(" None}", " null}")
    return s


RE_NTF_UPLOAD = re.compile(
    r"notify_upload.*?md5=([a-f0-9]{32}), mode=(\w+), task=([-\w]+)"
)
RE_DOWNLOAD = re.compile(r"Download file: uploads/([a-f0-9]{32})")
RE_FINAL_STATUS = re.compile(r"Task status response: (\{.*\})")

RE_NVDEC = re.compile(r"FFmpeg NVDEC:")
RE_POSE = re.compile(r"pose_data: (\d+) poses, (\d+) frames, ([\d.]+)s")
RE_AUDIO_OK = re.compile(r"audio muxed into overlay \[\w+\]: (.+)")
RE_AUDIO_FAIL = re.compile(r"audio mux failed for (.+): (.+)")
RE_HARDWARE = re.compile(r"硬件加速:\s*(gpu|cpu)", re.IGNORECASE)

RE_EXPRESS_UPLOAD = re.compile(
    r"(?:upload|complete)[\s\S]{0,100}?"
    r"openid[=:]\s*(\w+).*?md5[=:]\s*([a-f0-9]{32})",
    re.DOTALL | re.IGNORECASE,
)


def parse_fastapi_logs(text: str) -> dict[str, dict]:
    md5_to_task = {}
    task_to_info = {}
    task_results = {}

    for line in text.splitlines():
        ts = _ts(line)

        m = RE_NTF_UPLOAD.search(line)
        if m:
            md5, mode, tid = m.group(1), m.group(2), m.group(3)
            task_to_info[tid] = {"md5": md5, "mode": mode, "upload_ts": ts}
            md5_to_task[md5] = tid

        m = RE_DOWNLOAD.search(line)
        if m:
            md5 = m.group(1)

        m = RE_FINAL_STATUS.search(line)
        if m:
            raw = _pyobj_to_json(m.group(1))
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            tid = data.get("task_id")
            if data.get("status") == "completed" and tid not in task_results:
                ov = data.get("overlayVideos", {}) or {}
                task_results[tid] = {
                    "duration": data.get("duration", 0),
                    "clips": data.get("clips", 0),
                    "overlay_count": sum(1 for v in ov.values() if v),
                    "status": data.get("status"),
                    "scores": json.dumps(data.get("scores", {}), ensure_ascii=False),
                    "thumbnail": data.get("thumbnailUrl", ""),
                    "size": data.get("size", 0),
                    "completed_ts": ts,
                }

    records = {}
    for md5, tid in md5_to_task.items():
        info = task_to_info.get(tid, {})
        res = task_results.get(tid, {})
        upload_ts = info.get("upload_ts", "")
        completed_ts = res.get("completed_ts", "")
        proc_sec = ""
        if upload_ts and completed_ts:
            try:
                up = datetime.strptime(upload_ts, "%Y-%m-%d %H:%M:%S")
                cp = datetime.strptime(completed_ts, "%Y-%m-%d %H:%M:%S")
                proc_sec = int((cp - up).total_seconds())
            except ValueError:
                pass
        records[md5] = {
            "md5": md5,
            "mode": info.get("mode", ""),
            "task_id": tid,
            "upload_time": upload_ts,
            "completed_time": completed_ts,
            "processing_sec": proc_sec,
            "duration_sec": res.get("duration", 0),
            "clip_count": res.get("clips", 0),
            "overlay_count": res.get("overlay_count", 0),
            "status": res.get("status", "unknown"),
            "file_size": res.get("size", 0),
            "scores": res.get("scores", "{}"),
            "thumbnail": res.get("thumbnail", ""),
        }
    return records


def parse_decoder_stats(text: str) -> dict:
    hw_mode = "n/a"
    if RE_NVDEC.search(text):
        hw_mode = "gpu"
    m = RE_HARDWARE.search(text)
    if m:
        hw_mode = m.group(1).lower()

    pose_list = RE_POSE.findall(text)
    audio_ok = len(RE_AUDIO_OK.findall(text))
    audio_fail = len(RE_AUDIO_FAIL.findall(text))

    return {
        "hardware": hw_mode,
        "pose_calls": len(pose_list),
        "total_poses": sum(int(p[0]) for p in pose_list) if pose_list else 0,
        "total_frames": sum(int(p[1]) for p in pose_list) if pose_list else 0,
        "audio_mux_ok": audio_ok,
        "audio_mux_fail": audio_fail,
    }


def parse_express_logs(text: str) -> dict[str, dict]:
    records = {}
    for line in text.splitlines():
        m = RE_EXPRESS_UPLOAD.search(line)
        if m:
            openid, md5 = m.group(1), m.group(2)
            if md5 not in records:
                records[md5] = {
                    "openid": openid,
                    "md5": md5,
                    "ts": line[:19] if len(line) >= 19 else "",
                }
    return records


# ── 关联 ──────────────────────────────────────────────────────────────


def merge_records(
    fastapi: dict[str, dict],
    express: dict[str, dict],
    decoder_stats: dict,
) -> list[dict]:
    records = []
    for md5, f in fastapi.items():
        e = express.get(md5, {})
        records.append({
            "date": f.get("upload_time", "")[:10],
            "openid": e.get("openid", ""),
            "md5": md5,
            "mode": f.get("mode", ""),
            "file_size_mb": round(f.get("file_size", 0) / 1_000_000, 2),
            "task_id": f.get("task_id", ""),
            "upload_time": f.get("upload_time", ""),
            "completed_time": f.get("completed_time", ""),
            "processing_sec": f.get("processing_sec", ""),
            "hardware": decoder_stats.get("hardware", "n/a"),
            "duration_sec": f.get("duration_sec", 0),
            "clip_count": f.get("clip_count", 0),
            "overlay_count": f.get("overlay_count", 0),
            "status": f.get("status", ""),
            "scores": f.get("scores", "{}"),
        })
    return records


# ── 告警 ──────────────────────────────────────────────────────────────


def check_record_alerts(rec: dict) -> list[str]:
    alerts = []
    tag = f"[{rec.get('upload_time','?')}] md5={rec.get('md5','')[:12]} openid={rec.get('openid','?')}"

    if rec.get("duration_sec", -1) == 0 and rec.get("status") == "completed":
        alerts.append(f"ERROR {tag} duration=0, 分析可能失败")
    if rec.get("clip_count", -1) == 0 and rec.get("status") == "completed":
        alerts.append(f"WARN {tag} 0 clips, 未检测到回合")
    if rec.get("mode") == "training_analysis" and rec.get("overlay_count", 0) < 5 and rec.get("status") == "completed":
        alerts.append(f"WARN {tag} overlay 不全 ({rec['overlay_count']}/5)")
    if rec.get("file_size_mb", 0) > 500:
        alerts.append(f"INFO {tag} 超大文件 ({rec['file_size_mb']}MB)")

    return alerts


def check_decoder_alerts(stats: dict) -> list[str]:
    alerts = []
    if stats.get("hardware") == "cpu":
        alerts.append(f"CRITICAL Decoder 运行为 CPU 模式 (异常降级)")
    if stats.get("audio_mux_fail", 0) > stats.get("audio_mux_ok", 0):
        alerts.append(f"ERROR 音频混流失败率高于成功率 ({stats['audio_mux_fail']} fail vs {stats['audio_mux_ok']} ok)")
    if stats.get("pose_calls", 0) == 0:
        # all zero = no decoder activity = normal idle, skip alert
        if stats.get("audio_mux_ok", 0) > 0 or stats.get("audio_mux_fail", 0) > 0:
            alerts.append(f"WARN Decoder 本周期无 pose_data 输出 (audio active but no pose)")
    return alerts



# Express 健康检查 (新增 2026-08-30)


def _ssh_exec(host, cmd, timeout=15):
    try:
        r = subprocess.run(
            ["ssh", host, "-o", "ConnectTimeout=10", "-o", "BatchMode=yes",
             "-o", "StrictHostKeyChecking=no", "--"] + cmd,
            capture_output=True, text=True, timeout=timeout
        )
        return r.stdout.strip(), r.returncode
    except Exception:
        return "", -1


def check_mongodb_health(ssh_host):
    out, rc = _ssh_exec(ssh_host, [
        "timeout", "5", "docker", "exec", "mongodb",
        "mongosh", "-u", "wechatuser", "-p", "wechatpass123",
        "--authenticationDatabase", "wechat", "wechat",
        "--quiet", "--eval", "db.runCommand({ping:1})"
    ], timeout=15)
    if rc != 0 or '"ok" : 1' not in out.replace(' ', ''):
        return [f"CRITICAL express-node MongoDB ping failed (rc={rc})"]
    return []


def check_express_disk(ssh_host):
    out, rc = _ssh_exec(ssh_host, ["df", "-h", "/"], timeout=10)
    if rc != 0:
        return [f"WARN express-node disk check failed (rc={rc})"]
    lines = out.strip().split(chr(10))
    if len(lines) < 2:
        return []
    try:
        parts = lines[1].split()
        pct = int(parts[4].replace('%', ''))
        if pct >= 90:
            return [f"CRITICAL express-node disk {pct}% ({parts[2]}/{parts[1]})"]
        if pct >= 80:
            return [f"WARN express-node disk {pct}% ({parts[2]}/{parts[1]})"]
    except (ValueError, IndexError):
        pass
    return []


def check_express_errors(express_log):
    alerts = []
    archive_fails = 0
    mongo_errors = 0
    for line in express_log.splitlines():
        if 'media-archive] scan failed:' in line or 'superseded cleanup retry failed:' in line:
            archive_fails += 1
        if 'getaddrinfo EAI_AGAIN mongodb' in line or 'connect ECONNREFUSED' in line:
            mongo_errors += 1
    if archive_fails >= 3:
        alerts.append(f"ERROR express-node OSS archive failed {archive_fails} times")
    if mongo_errors >= 5:
        alerts.append(f"CRITICAL express-node MongoDB connection errors {mongo_errors} times")
    return alerts

def send_webhook(alerts: list[str]) -> None:
    if not WEBHOOK_URL or not alerts:
        return
    content = "## TTAI 日志告警\n" + "\n".join(f"> {a}" for a in alerts[:20])
    try:
        if "sctapi.ftqq.com" in WEBHOOK_URL:
            base_url = WEBHOOK_URL.rstrip(".send")
            data = urlencode({"title": "TTAI 日志告警", "desp": content}).encode()
            req = Request(base_url + ".send", data=data,
                          headers={"Content-Type": "application/x-www-form-urlencoded"})
        elif "pushplus.plus" in WEBHOOK_URL:
            body = json.dumps({"title": "TTAI 日志告警", "content": content, "template": "markdown"},
                              ensure_ascii=False).encode()
            req = Request(WEBHOOK_URL, data=body,
                          headers={"Content-Type": "application/json"})
        else:
            body = json.dumps({"msgtype": "markdown", "markdown": {"content": content}},
                              ensure_ascii=False).encode()
            req = Request(WEBHOOK_URL, data=body,
                          headers={"Content-Type": "application/json"})
        urlopen(req, timeout=10)
        print(f"  [webhook] sent {len(alerts)} alerts", file=sys.stderr)
    except Exception as e:
        print(f"  [webhook] failed: {e}", file=sys.stderr)


# ── 告警去重 ─────────────────────────────────────────────────────────


def load_sentinel() -> dict:
    if SENTINEL_PATH.exists():
        try:
            with open(SENTINEL_PATH) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_sentinel(data: dict) -> None:
    SENTINEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(SENTINEL_PATH, "w") as f:
            json.dump(data, f)
    except OSError as e:
        print(f"  [!] save sentinel: {e}", file=sys.stderr)


def filter_new_alerts(alerts: list[str], sentinel: dict) -> list[str]:
    now = datetime.now().timestamp()
    new_alerts = []
    for alert in alerts:
        sig = alert[:80]
        last_ts = sentinel.get(sig, 0)
        if now - last_ts > SENTINEL_TTL.total_seconds():
            new_alerts.append(alert)
            sentinel[sig] = now

    # 清理过期条目（2倍 TTL 以上）
    stale_threshold = now - SENTINEL_TTL.total_seconds() * 2
    for k in list(sentinel):
        if sentinel[k] < stale_threshold:
            del sentinel[k]

    return new_alerts


# ── ── 解析 --lookback ── ──


def parse_lookback(text: str) -> timedelta | None:
    """'30m'→30分钟, '2h'→2小时, '1d'→1天"""
    if not text:
        return None
    text = text.strip().lower()
    unit = text[-1]
    try:
        val = int(text[:-1])
    except ValueError:
        return None
    if unit == "m":
        return timedelta(minutes=val)
    if unit == "h":
        return timedelta(hours=val)
    if unit == "d":
        return timedelta(days=val)
    return None


# ── 主流程 ────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="TTAI 日志扫描 v0.3")
    parser.add_argument("--since", help="起始时间 (default: 24h ago)")
    parser.add_argument("--lookback", help="例如: 30m, 2h, 1d (覆盖 --since)")
    parser.add_argument("--dry-run", action="store_true", help="只打印不写文件")
    args = parser.parse_args()

    if args.lookback:
        delta = parse_lookback(args.lookback)
        if delta:
            since = (datetime.now() - delta).strftime("%Y-%m-%dT%H:%M:%S")
        else:
            print(f"  [!] 无法解析 --lookback={args.lookback}, 回退到 24h", file=sys.stderr)
            since = (datetime.now() - timedelta(hours=24)).strftime("%Y-%m-%d")
    else:
        since = args.since or (datetime.now() - timedelta(hours=24)).strftime("%Y-%m-%d")

    today = datetime.now().strftime("%Y-%m-%d")
    print(f"TTAI Scan [{since}] → {today}" + (" (dry-run)" if args.dry_run else ""))

    # ── 1. 采集 ──
    print("  [1/4] dev-backend-1 ...", end="", flush=True)
    backend_log = docker_logs("dev-backend-1", since)
    print(f" {len(backend_log.splitlines())} lines")

    print("  [2/4] dev-decode-0 + 1 ...", end="", flush=True)
    dec0 = docker_logs("dev-decode-0", since)
    dec1 = docker_logs("dev-decode-1", since)
    decoder_log = dec0 + "\n" + dec1
    print(f" {len(decoder_log.splitlines())} lines")

    print("  [3/4] Express (SSH) ...", end="", flush=True)
    express_log = ""
    for container in EXPRESS_CONTAINERS:
        express_log = remote_docker_logs(SSH_EXPRESS, container, since)
        if express_log.strip():
            break
    print(f" {len(express_log.splitlines()) if express_log.strip() else 0} lines"
           + (" (SSH unavailable)" if not express_log.strip() else ""))

    # ── 2. 解析 ──
    print("  [4/4] Parsing...", end="", flush=True)
    fastapi_records = parse_fastapi_logs(backend_log)
    decoder_stats = parse_decoder_stats(decoder_log)
    express_records = parse_express_logs(express_log)
    merged = merge_records(fastapi_records, express_records, decoder_stats)
    print(f" {len(merged)} records, decoder={decoder_stats.get('hardware','n/a')}")

    # ── 3. 输出 CSV (按 md5 去重追加) ──
    fields = [
        "date", "upload_time", "completed_time", "processing_sec",
        "openid", "md5", "mode", "file_size_mb",
        "task_id", "hardware", "duration_sec", "clip_count",
        "overlay_count", "status", "scores",
    ]

    if args.dry_run:
        if merged:
            print(f"  CSV would append {len(merged)} rows to {today}.csv")
        else:
            print("  No records.")
    else:
        csv_path = DAILY_DIR / f"{today}.csv"
        existing_md5s: set[str] = set()
        if csv_path.exists():
            try:
                with open(csv_path, newline="") as f:
                    for row in csv.DictReader(f):
                        existing_md5s.add(row.get("md5", ""))
            except Exception as e:
                print(f"  [!] read existing CSV: {e}", file=sys.stderr)

        new_records = [r for r in merged if r["md5"] not in existing_md5s]
        file_exists = csv_path.exists()
        with open(csv_path, "a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            if not file_exists:
                w.writeheader()
            w.writerows(new_records)
        print(f"  CSV: {csv_path} ({len(new_records)} new / {len(existing_md5s)} existing)")

    # ── 4. 告警 (去重) ──
    sentinel = load_sentinel()
    all_alerts = []
    for rec in merged:
        all_alerts.extend(check_record_alerts(rec))
    all_alerts.extend(check_decoder_alerts(decoder_stats))

    # Express 健康检查
    if express_log.strip():
        all_alerts.extend(check_mongodb_health(SSH_EXPRESS))
        all_alerts.extend(check_express_disk(SSH_EXPRESS))
        all_alerts.extend(check_express_errors(express_log))
    else:
        all_alerts.append("WARN express-node SSH unreachable")

    if all_alerts:
        fresh_alerts = filter_new_alerts(all_alerts, sentinel)

        if not args.dry_run:
            alert_path = ALERT_DIR / f"{today}.log"
            with open(alert_path, "a") as f:
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                for a in fresh_alerts:
                    f.write(f"[{now_str}] {a}\n")
            print(f"  Alerts: {alert_path} ({len(fresh_alerts)} new / {len(all_alerts)} total)")
            save_sentinel(sentinel)
            if fresh_alerts:
                # Auto-RCA
                enhanced_alerts = []
                for alert_text in fresh_alerts:
                    ctx = {"alert": alert_text, "backend_log": backend_log, "decoder_log": decoder_log, "records": merged, "sentinel": sentinel}
                    rca = run_rca(alert_text, ctx)
                    if rca.get("root_cause") and rca.get("confidence") in ("high", "medium"):
                        enhanced = alert_text + "\n  **RCA**: " + rca["root_cause"]
                        if rca.get("evidence"):
                            enhanced += "\n    evidence: " + rca["evidence"]
                        if rca.get("suggestion"):
                            enhanced += "\n    suggest: " + rca["suggestion"]
                    else:
                        enhanced = alert_text
                    enhanced_alerts.append(enhanced)
                send_webhook(enhanced_alerts)
        else:
            print(f"  Alerts ({len(all_alerts)}):")
            for a in all_alerts:
                print(f"    {a}")
    else:
        print("  No alerts. Clean run.")

    # ---- trend ----
    update_daily_trend(merged, decoder_stats)
    update_alert_trend(fresh_alerts if all_alerts else [])

    # ── 5. 清理旧日志 (90天) ──
    max_age = timedelta(days=90)
    for d, ext in [(DAILY_DIR, ".csv"), (ALERT_DIR, ".log")]:
        for p in d.glob(f"*{ext}"):
            try:
                if (datetime.now() - datetime.fromtimestamp(p.stat().st_mtime)) > max_age:
                    p.unlink()
                    print(f"  Cleaned: {p}")
            except OSError:
                pass

    if merged:
        print(f"  Summary: {len(merged)} records,"
              f" {decoder_stats['pose_calls']} decode calls,"
              f" mode={decoder_stats['hardware']}")


if __name__ == "__main__":
    main()
