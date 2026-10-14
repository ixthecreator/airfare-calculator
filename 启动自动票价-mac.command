#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 server.py --ask-key --open
else
  print '需要安装 Python 3。离线计算可直接打开机票兑换成本计算器.html。'
fi
read -r '?按回车关闭此窗口。'
