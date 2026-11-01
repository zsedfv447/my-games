#!/bin/zsh
# 雙擊這個檔案就能啟動星光冒險（不需要 Claude）。關掉這個終端機視窗，遊戲伺服器就會停止。
cd "$(dirname "$0")"
if curl -s -o /dev/null http://127.0.0.1:4201/; then
  echo "遊戲已經在執行中，直接開啟瀏覽器。"
else
  echo "正在啟動星光冒險……（第一次可能要等幾秒）"
  npx vite --host 127.0.0.1 --port 4201 --strictPort &
  for i in {1..30}; do curl -s -o /dev/null http://127.0.0.1:4201/ && break; sleep 1; done
fi
open "http://127.0.0.1:4201/"
wait
