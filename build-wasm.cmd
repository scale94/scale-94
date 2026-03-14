@echo off
echo [BUILD-WASM] Starting Rust/WASM compilation pipeline...
cd /d "E:\scale_9.4"
node scripts/import-rust.js
echo [BUILD-WASM] Exit code: %ERRORLEVEL%
