---
description: "PUA 离线模式 — 关闭本地反馈问卷，保留本地 PUA 行为。/pua:offline。Triggers on: '/pua:offline', '离线模式', '封闭网络', 'offline mode', 'no network'."
---

开启 PUA 离线模式，适用于内网、封闭网络，或不希望任务结束时被反馈问卷打断的环境。

> **注意**：PUA Skill 已移除全部联网上报功能（session 上传 / 评分上报 / 心跳 telemetry / 排行榜），**默认就不发送任何数据**。此命令现在只控制本地反馈问卷是否弹出，不再是"关闭上报"的开关。

## 执行

```bash
mkdir -p "$HOME/.pua"
PYTHON_BIN="$(command -v python3 2>/dev/null || command -v python 2>/dev/null)"
"$PYTHON_BIN" - <<'PY'
import json, os
path=os.path.expanduser('~/.pua/config.json')
try:
    data=json.load(open(path, encoding='utf-8'))
except Exception:
    data={}
data['offline']=True
data['feedback_frequency']=0
data.setdefault('always_on', True)
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')
PY
```

## 输出确认

> [PUA OFFLINE] 已进入离线模式：保留本地压力/验证协议，不再弹出反馈问卷。恢复问卷时编辑 `~/.pua/config.json`：`"offline": false` 并设置 `feedback_frequency`。

## 设计边界

- 离线模式不等于 `/pua:off`：PUA 行为仍可开启。
- 离线模式只关闭本地反馈问卷；PUA Skill 本身已无任何联网上报代码，无需靠此开关阻止上传。
- 不会替用户禁止模型或其他工具联网。真正的网络隔离仍应由运行环境、防火墙或工具权限控制完成。
