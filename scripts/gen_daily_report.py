#!/usr/bin/env python3
"""
TTAI 日报生成 — 从阿里云 MongoDB 查询当日视频分析记录，按用户汇总并推送
用法:
  python3 gen_daily_report.py                      # 今日报告
  python3 gen_daily_report.py --date 2026-06-07    # 指定日期
  python3 gen_daily_report.py --dry-run            # 只打印不推送

依赖: 仅 Python 3 标准库 + SSH key 到 express-node (阿里云 MongoDB)
"""

import argparse
import json
import os
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone, date as dt_date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LOG_DIR = Path("logs")
REPORT_DIR = LOG_DIR / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

WEBHOOK_URL = os.environ.get("TTAI_ALERT_WEBHOOK", "")
TZ = timezone(timedelta(hours=8), "CST")

EXPRESS_HOST = "express-node"


def _run_ssh(host: str, cmd: str, timeout: int = 15) -> str:
    ssh_cmd = [
        "ssh", host,
        "-o", "ConnectTimeout=15",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=no",
        "--", cmd,
    ]
    try:
        r = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except Exception as e:
        print(f"  [ssh {host}] {e}", file=sys.stderr)
        return ""


def _run_mongo(js_code: str) -> str:
    ssh_cmd = [
        "ssh", EXPRESS_HOST,
        "-o", "ConnectTimeout=15",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=no",
        "--",
        "docker", "exec", "-i", "mongodb",
        "mongosh", "-u", "wechatuser", "-p", "wechatpass123",
        "--authenticationDatabase", "wechat", "wechat",
        "--quiet",
    ]
    try:
        r = subprocess.run(ssh_cmd, input=js_code, capture_output=True, text=True, timeout=60)
        for line in r.stdout.splitlines():
            stripped = line.strip()
            if stripped.startswith("["):
                return stripped
        text = r.stdout
        idx = text.find("[")
        if idx >= 0:
            return text[idx:]
        return text
    except Exception as e:
        print(f"  [!] mongosh via SSH: {e}", file=sys.stderr)
        return ""


ESCAPE_JSON = str.maketrans({
    '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t',
})


def _jsesc(s: str) -> str:
    return s.translate(ESCAPE_JSON)


# ── 系统资源采集 ──
def fetch_sysinfo() -> dict:
    info = {}

    # dev-node: 内存 / 磁盘 / 负载
    try:
        r = subprocess.run(
            "free -h | grep Mem; echo ---; df -h / | tail -1; echo ---; uptime",
            capture_output=True, text=True, shell=True, timeout=10
        )
        parts = r.stdout.strip().split("\n---\n")
        if len(parts) >= 3:
            mem = parts[0].strip()
            disk = parts[1].strip()
            load = parts[2].strip()
            mem_f = mem.split()
            info["dev_mem"] = f"使用 {mem_f[2]} / 共 {mem_f[1]}"
            info["dev_disk"] = disk
            info["dev_load"] = load
        else:
            info["dev_mem"] = parts[0][:80] if parts[0] else "N/A"
    except Exception as e:
        info["dev_mem"] = f"error: {e}"

    # dev-node: GPU
    try:
        r = subprocess.run(
            "nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw --format=csv,noheader",
            capture_output=True, text=True, shell=True, timeout=10
        )
        gpu = r.stdout.strip()
        if gpu and gpu != "Failed to initialize NVML: Unknown Error":
            info["dev_gpu"] = gpu[:120]
        else:
            info["dev_gpu"] = "N/A"
    except Exception as e:
        info["dev_gpu"] = f"error: {e}"

    # express-node: 内存 / 磁盘 / 负载 / swap
    out = _run_ssh(EXPRESS_HOST,
        "free -h | grep Mem; echo DISK:$(df -h / | tail -1); echo LOAD:$(uptime); echo SWAP:$(free -h | grep Swap)")
    lines = [l.strip() for l in out.split("\n") if l.strip()]
    if len(lines) >= 1:
        f = lines[0].split()
        info["express_mem"] = f"使用 {f[2]} / 共 {f[1]}" if len(f) >= 4 else lines[0][:60]
    else:
        info["express_mem"] = "N/A"
    info["express_disk"] = lines[1].replace("DISK:", "").strip()[:50] if len(lines) > 1 else "N/A"
    info["express_load"] = lines[2].replace("LOAD:", "").strip()[:60] if len(lines) > 2 else "N/A"
    info["express_swap"] = lines[3].replace("SWAP:", "").strip()[:40] if len(lines) > 3 else "N/A"

    return info


# ── MongoDB 查询 ──
def fetch_videos(date_from: str, date_to: str) -> list[dict]:
    js = (
        'const s=new Date("' + _jsesc(date_from) + 'T00:00:00+08:00"),'
        'e=new Date("' + _jsesc(date_to) + 'T00:00:00+08:00");'
        'const p=[{$match:{createdAt:{$gte:s,$lt:e}}},{$sort:{createdAt:-1}},'
        '{$lookup:{from:"wechat_user",localField:"openid",foreignField:"openid",as:"user"}},'
        '{$addFields:{nickname:{$ifNull:[{$arrayElemAt:["$user.nickname",0]},"未知"]}}},'
        '{$project:{_id:0,user:0,__v:0}}];'
        'print(JSON.stringify(db.videos.aggregate(p).toArray()));'
    )
    raw = _run_mongo(js)
    if not raw.strip():
        return []
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError as e:
        print(f"  [!] JSON parse error: {e}", file=sys.stderr)
        print(f"  raw[:500]: {raw[:500]}", file=sys.stderr)
        return []




def fetch_users_status(date_from: str, date_to: str) -> list[dict]:
    js = (
        'const s=new Date("' + _jsesc(date_from) + 'T00:00:00+08:00"),'
        'e=new Date("' + _jsesc(date_to) + 'T00:00:00+08:00");'
        'const r=db.wechat_user.aggregate(['
        '{$lookup:{from:"videos",let:{openid:"$openid"},'
        'pipeline:[{$match:{$expr:{$eq:["$openid","$$openid"]},createdAt:{$gte:s,$lt:e}}},'
        '{$project:{_id:0,openid:1,duration:1}}],as:"todayVideos"}},'
        '{$addFields:{todayTotal:{$size:"$todayVideos"},'
        'todaySuccess:{$size:{$filter:{input:"$todayVideos",as:"v",cond:{$gt:["$$v.duration",0]}}}}}},'
        '{$project:{_id:0,openid:1,nickname:1,membershipTier:1,remainingAnalyses:1,todayTotal:1,todaySuccess:1}},'
        '{$sort:{todayTotal:-1,nickname:1}}]);'
        'print(JSON.stringify(r.toArray()));'
    )
    raw = _run_mongo(js)
    if not raw.strip():
        return []
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError as e:
        print(f"  [!] user status JSON parse error: {e}", file=sys.stderr)
        return []

def _sysinfo_section(sysinfo: dict) -> str:
    if not sysinfo:
        return ""
    lines = []
    lines.append("### :desktop: 系统资源")
    lines.append("")
    lines.append("| 节点 | 内存 | 磁盘 | 负载 | GPU / Swap |")
    lines.append("|------|------|------|------|------------|")
    lines.append(
        f"| dev-node "
        f"| {sysinfo.get('dev_mem', 'N/A')} "
        f"| {sysinfo.get('dev_disk', '')[:35]} "
        f"| {sysinfo.get('dev_load', '')[:40]} "
        f"| {sysinfo.get('dev_gpu', 'N/A')[:50]} |"
    )
    swap = sysinfo.get('express_swap', '')
    swap_txt = f"swap {swap}" if swap and swap != "N/A" else "—"
    lines.append(
        f"| express-node "
        f"| {sysinfo.get('express_mem', 'N/A')} / {swap_txt} "
        f"| {sysinfo.get('express_disk', '')[:35]} "
        f"| {sysinfo.get('express_load', '')[:40]} "
        f"| — |"
    )
    return "\n".join(lines)




def _user_status_section(users: list[dict]) -> str:
    if not users:
        return ''
    tier_labels = {'seeding': '体验', 'normal': '普通', 'silver': '白银', 'diamond': '钻石', 'king': '王者', 'trial': '试用'}
    lines = ['', '### :busts_in_silhouette: 用户状态统计', '']
    lines.append('| # | 昵称 | 级别 | 今日分析 | 成功 | 失败 | 成功率 | 剩余次数 |')
    lines.append('|---|------|------|----------|------|------|--------|----------|')
    for i, u in enumerate(users, 1):
        nick = u.get('nickname', '') or '未知'
        tier = u.get('membershipTier', '') or ''
        tier_label = tier_labels.get(tier, tier)
        total = u.get('todayTotal', 0)
        success = u.get('todaySuccess', 0)
        failed = total - success
        rate = f'{success * 100 // total}%' if total > 0 else '---'
        remaining = u.get('remainingAnalyses', 0)
        lines.append(f'| {i} | {nick} | {tier_label} | {total} | {success} | {failed} | {rate} | {remaining} |')
    active = sum(1 for u in users if u.get('todayTotal', 0) > 0)
    lines.append('')
    lines.append(f'共 {len(users)} 用户（今日活跃 {active}）')
    return '\n'.join(lines)

def markdown_report(records: list[dict], sysinfo: dict, report_date: str, user_status: list | None = None) -> str:
    if not records:
        body = f"## TTAI 日报 {report_date}\n\n当日无分析记录。"
        sec = _sysinfo_section(sysinfo)
        if sec:
            body += "\n\n---\n\n" + sec
        return body

    users = defaultdict(list)
    for r in records:
        users[r.get("openid", "unknown")].append(r)

    def _ok(r):
        return r.get("duration", 0) > 0

    total = len(records)
    success = sum(1 for r in records if _ok(r))
    failed = total - success
    training = sum(1 for r in records if r.get("mode") == "training_analysis")
    match = sum(1 for r in records if r.get("mode") == "match_clip")

    lines = []
    lines.append(f"## TTAI 日报 {report_date}")
    lines.append("")
    lines.append(f"**用户数**: {len(users)} | **分析数**: {total} | **成功**: {success} | **异常**: {failed}")
    lines.append(f"**训练视频**: {training} | **比赛视频**: {match}")
    lines.append("")
    lines.append("### :bar_chart: 用户汇总")
    lines.append("| 用户 | 昵称 | 训练 | 比赛 | 共分析 | 成功 | 异常 |")
    lines.append("|------|------|------|------|--------|------|------|")
    for uid, recs in sorted(users.items(), key=lambda x: -len(x[1])):
        nickname = recs[0].get("nickname", "") or "未知"
        t_cnt = sum(1 for r in recs if r.get("mode") == "training_analysis")
        m_cnt = sum(1 for r in recs if r.get("mode") == "match_clip")
        ok = sum(1 for r in recs if _ok(r))
        ng = len(recs) - ok
        lines.append(f"| `{uid[:12]}...` | {nickname} | {t_cnt} | {m_cnt} | {len(recs)} | {ok} | {ng} |")
    lines.append("")
    lines.append("### :page_facing_up: 用户详情")
    for uid, recs in sorted(users.items(), key=lambda x: -len(x[1])):
        nickname = recs[0].get("nickname", "") or "未知"
        ok_count = sum(1 for r in recs if _ok(r))
        status_icon = ":white_check_mark:" if ok_count == len(recs) else ":warning:"
        lines.append("")
        lines.append(f"#### {status_icon} {nickname} ({len(recs)}次)")
        lines.append("")
        lines.append("| 时间 | 模式 | 时长 | 大小 | 回合 | 得分 | 状态 |")
        lines.append("|------|------|------|------|------|------|------|")
        for r in recs:
            ts = r.get("createdAt", "")
            if isinstance(ts, str):
                ts = ts[11:16] if len(ts) >= 16 else ts
            elif isinstance(ts, dict) and "$date" in ts:
                ts = ts["$date"][11:16] if len(ts["$date"]) >= 16 else ts["$date"]
            mode = "训练" if r.get("mode") == "training_analysis" else "比赛"
            dur = f'{r.get("duration", 0)}s'
            size_mb = round(r.get("size", 0) / 1_000_000, 1) if r.get("size") else 0
            clips = r.get("clips", 0)
            score = (r.get("scores", {}) or {}).get("overall", 0) if isinstance(r.get("scores"), dict) else 0
            ok = ":white_check_mark:" if _ok(r) else ":x:"
            lines.append(f"| {ts} | {mode} | {dur} | {size_mb}MB | {clips} | {score} | {ok} |")

    sec = _sysinfo_section(sysinfo)
    if sec:
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(sec)

    return "\n".join(lines)


def send_webhook(title: str, content: str) -> None:
    if not WEBHOOK_URL:
        print("  [webhook] TTAI_ALERT_WEBHOOK not set", file=sys.stderr)
        return
    try:
        if "sctapi.ftqq.com" in WEBHOOK_URL:
            base_url = WEBHOOK_URL.rstrip(".send")
            data = urlencode({"title": title, "desp": content}).encode()
            req = Request(base_url + ".send", data=data,
                          headers={"Content-Type": "application/x-www-form-urlencoded"})
        elif "pushplus.plus" in WEBHOOK_URL:
            body = json.dumps({"title": title, "content": content, "template": "markdown"},
                              ensure_ascii=False).encode()
            req = Request(WEBHOOK_URL, data=body,
                          headers={"Content-Type": "application/json"})
        elif "qyapi.weixin.qq.com" in WEBHOOK_URL:
            body = json.dumps({"msgtype": "markdown", "markdown": {"content": content}},
                              ensure_ascii=False).encode()
            req = Request(WEBHOOK_URL, data=body,
                          headers={"Content-Type": "application/json"})
        else:
            body = json.dumps({"title": title, "content": content}, ensure_ascii=False).encode()
            req = Request(WEBHOOK_URL, data=body,
                          headers={"Content-Type": "application/json"})
        urlopen(req, timeout=15)
        print(f"  [webhook] sent: {title}", file=sys.stderr)
    except Exception as e:
        print(f"  [webhook] failed: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="TTAI 日报生成")
    parser.add_argument("--date", help="日期 (default: 今天)")
    parser.add_argument("--dry-run", action="store_true", help="只打印不推送")
    parser.add_argument("--output", help="输出路径 (default: logs/reports/{date}.md)")
    args = parser.parse_args()

    if args.date:
        report_date = args.date
        date_from = report_date
        date_to = (datetime.strptime(report_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        report_date = datetime.now(TZ).strftime("%Y-%m-%d")
        date_from = report_date
        date_to = (datetime.now(TZ) + timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"TTAI 日报 [{date_from}]")

    records = fetch_videos(date_from, date_to)
    print(f"  MongoDB: {len(records)} records")

    sysinfo = fetch_sysinfo()
    print(f"  System: dev-mem={sysinfo.get('dev_mem','')[:40]} | "
          f"express-mem={sysinfo.get('express_mem','')[:30]}")

    user_status = fetch_users_status(date_from, date_to)
    report = markdown_report(records, sysinfo, report_date, user_status=user_status)
    print(f"  Report: {len(report)} chars")

    report_path = Path(args.output) if args.output else (REPORT_DIR / f"{report_date}.md")
    if not args.dry_run:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"  Saved: {report_path}")
    else:
        print(f"  Would save: {report_path}")

    summary = f"TTAI 日报 {report_date}: {len(records)}条分析"
    if not args.dry_run:
        send_webhook(summary, report)
    else:
        print(f"\n{'='*60}")
        print(report[:2000])
        print("..." if len(report) > 2000 else "")

    max_age = timedelta(days=30)
    for p in REPORT_DIR.glob("*.md"):
        try:
            if (datetime.now() - datetime.fromtimestamp(p.stat().st_mtime)) > max_age:
                p.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    main()
