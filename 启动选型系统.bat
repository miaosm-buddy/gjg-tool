@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 起重机械选型系统
echo.
echo  ============================================================
echo     起重机械智能选型系统
echo  ============================================================
echo.
echo  方式1: 直接双击 [index_完整离线版.html] 即可离线使用
echo  方式2: 启动本地服务（端口5001，data.js已gzip压缩）
echo.
python server.py
pause
