@echo off
echo [BUILD-WASM] Initializing VS build environment...
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" > nul 2>&1
echo [BUILD-WASM] LIB=%LIB%
echo [BUILD-WASM] Running wasm-pack...
cd /d "E:\scale_9.4\content\rust_kernels"
"C:\Users\raul-\.cargo\bin\wasm-pack.exe" build --target web --release
echo [BUILD-WASM] Exit code: %ERRORLEVEL%
