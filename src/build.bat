@echo off
REM Emscripten環境変数設定
call C:\P\Work\MSDFGenJs\emsdk\emsdk_env.bat

REM すべてのコアファイルを指定
emcc -o msdfgen.js ^
  -I../core ^
  ../core/contour-combiners.cpp ^
  ../core/Contour.cpp ^
  ../core/convergent-curve-ordering.cpp ^
  ../core/DistanceMapping.cpp ^
  ../core/edge-coloring.cpp ^
  ../core/edge-segments.cpp ^
  ../core/edge-selectors.cpp ^
  ../core/EdgeHolder.cpp ^
  ../core/equation-solver.cpp ^
  ../core/export-svg.cpp ^
  ../core/msdf-error-correction.cpp ^
  ../core/MSDFErrorCorrection.cpp ^
  ../core/msdfgen.cpp ^
  ../core/Projection.cpp ^
  ../core/rasterization.cpp ^
  ../core/render-sdf.cpp ^
  ../core/save-bmp.cpp ^
  ../core/save-fl32.cpp ^
  ../core/save-rgba.cpp ^
  ../core/save-tiff.cpp ^
  ../core/Scanline.cpp ^
  ../core/sdf-error-estimation.cpp ^
  ../core/shape-description.cpp ^
  ../core/Shape.cpp ^
  -s WASM=1 ^
  -s EXPORTED_FUNCTIONS="['_malloc','_free']" ^
  -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" ^
  -s MODULARIZE=1 ^
  -s EXPORT_NAME="createMsdfgenModule" ^
  -s ALLOW_MEMORY_GROWTH=1 ^
  -O3

echo Build complete!