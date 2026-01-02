@echo off
setlocal

:: This script assumes you have Emscripten (emsdk) installed and in your PATH.
:: AND you have cloned the original msdfgen repository into the PARENT directory of this tool.
:: Directory Structure:
::  /
::  ├── msdfgen/                   (Original repository)
::  └── MSDFGen-OnBrowser/         (This repository)
::      └── src/
::          └── build.bat          (This script)

set MSDFGEN_PATH=../../msdfgen

if not exist "%MSDFGEN_PATH%/msdfgen.h" (
    echo [ERROR] msdfgen source not found at %MSDFGEN_PATH%
    echo Please clone https://github.com/Chlumsky/msdfgen to the parent directory.
    exit /b 1
)

echo Building MSDF wrapper for WebAssembly...

:: Compile with optimizations and SIMD support
call emcc wasm_wrapper.cpp ^
    %MSDFGEN_PATH%/core/*.cpp ^
    %MSDFGEN_PATH%/ext/*.cpp ^
    -I%MSDFGEN_PATH% ^
    -O3 ^
    -msimd128 ^
    -s WASM=1 ^
    -s EXPORTED_FUNCTIONS="['_generate_msdf_from_svg', '_malloc', '_free']" ^
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8']" ^
    -s ALLOW_MEMORY_GROWTH=1 ^
    -s INITIAL_MEMORY=67108864 ^
    -o ../msdfgen.js

if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] msdfgen.js and msdfgen.wasm have been updated in the root directory.
) else (
    echo [FAILED] Compilation failed.
)

pause