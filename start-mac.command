#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 server.py --lan --open
else
  print '需要 Python 3 才能供手机访问。电脑离线使用可直接打开 index.html。'
fi
read -r '?按回车关闭此窗口。'
