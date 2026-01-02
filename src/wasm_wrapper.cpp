#include <emscripten.h>
#include <emscripten/console.h>
#include <cmath>
#include <stdio.h>
#include "../msdfgen.h"
#include "../msdfgen-ext.h"

using namespace msdfgen;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int generate_circle_msdf(int width, int height, unsigned char* output) {
    
    emscripten_console_log("C++: Starting MSDF generation with msdfgen library");
    emscripten_console_logf("C++: width=%d, height=%d, output=%p", width, height, output);
    
    try {
        // シンプルな円のシェイプを作成
        Shape shape;
        Contour &contour = shape.addContour();
        
        // 円を近似する8つのベジェ曲線セグメント
        const int segments = 8;
        const double radius = 0.4;
        const double centerX = 0.5;
        const double centerY = 0.5;
        
        for (int i = 0; i < segments; ++i) {
            double angle1 = 2.0 * M_PI * i / segments;
            double angle2 = 2.0 * M_PI * (i + 1) / segments;
            
            Point2 p1(centerX + radius * cos(angle1), centerY + radius * sin(angle1));
            Point2 p2(centerX + radius * cos(angle2), centerY + radius * sin(angle2));
            
            contour.addEdge(EdgeHolder(p1, p2));
        }
        
        emscripten_console_log("C++: Shape created with circle");
        
        // エッジカラーリング
        edgeColoringSimple(shape, 3.0);
        emscripten_console_log("C++: Edge coloring complete");
        
        // MSDF生成
        Bitmap<float, 3> msdf(width, height);
        generateMSDF(msdf, shape, 4.0, 1.0, Vector2(0.0, 0.0));
        emscripten_console_log("C++: MSDF generation complete");
        
        // RGBAバッファに変換
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int idx = (y * width + x) * 4;
                
                // MSDFの3チャンネル(RGB)を取得
                float r = msdf(x, y)[0];
                float g = msdf(x, y)[1];
                float b = msdf(x, y)[2];
                
                // 0.5を中心に0-1の範囲を0-255に変換
                output[idx + 0] = (unsigned char)(clamp(r, 0.0f, 1.0f) * 255.0f);
                output[idx + 1] = (unsigned char)(clamp(g, 0.0f, 1.0f) * 255.0f);
                output[idx + 2] = (unsigned char)(clamp(b, 0.0f, 1.0f) * 255.0f);
                output[idx + 3] = 255; // Alpha
            }
        }
        
        emscripten_console_log("C++: Conversion to RGBA complete");
        
        // 最初の数バイトを確認
        emscripten_console_logf("C++: First pixel RGBA: %d, %d, %d, %d", 
            output[0], output[1], output[2], output[3]);
        emscripten_console_logf("C++: Center pixel RGBA: %d, %d, %d, %d", 
            output[(height/2*width+width/2)*4+0], 
            output[(height/2*width+width/2)*4+1], 
            output[(height/2*width+width/2)*4+2], 
            output[(height/2*width+width/2)*4+3]);
        
        return 1;
        
    } catch (const std::exception& e) {
        emscripten_console_logf("C++: Exception: %s", e.what());
        return 0;
    } catch (...) {
        emscripten_console_log("C++: Unknown exception");
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE
int generate_msdf_from_svg(
    int width, 
    int height, 
    const char* svgPathData,
    double pxRange,
    unsigned char* output
) {
    emscripten_console_log("C++: Starting MSDF generation from SVG path");
    emscripten_console_logf("C++: width=%d, height=%d, pxRange=%.2f", width, height, pxRange);
    
    try {
        // SVGパスデータからShapeを構築
        Shape shape;
        
        emscripten_console_log("C++: Building shape from SVG path");
        bool success = buildShapeFromSvgPath(shape, svgPathData);
        
        if (!success) {
            emscripten_console_log("C++: Failed to build shape from SVG path");
            return 0;
        }
        
        emscripten_console_log("C++: Shape built successfully");
        
        // 公式msdfgenと同じ処理: normalize()を呼ぶ
        shape.normalize();
        
        // バウンディングボックスを取得
        Shape::Bounds bounds = shape.getBounds();
        emscripten_console_logf("C++: Shape bounds: left=%.2f, bottom=%.2f, right=%.2f, top=%.2f", 
            bounds.l, bounds.b, bounds.r, bounds.t);
        
        // 公式msdfgenのautoFrameロジックを実装
        double l = bounds.l, b = bounds.b, r = bounds.r, t = bounds.t;
        Vector2 frame(width, height);
        Vector2 scale_vec(1.0, 1.0);
        Vector2 translate_vec(0.0, 0.0);
        
        // pxRangeに基づいてフレームを調整
        frame.x -= 2.0 * pxRange;
        frame.y -= 2.0 * pxRange;
        
        if (l >= r || b >= t) {
            l = 0; b = 0; r = 1; t = 1;
        }
        if (frame.x <= 0 || frame.y <= 0) {
            emscripten_console_log("C++: Cannot fit the specified pixel range");
            return 0;
        }
        
        Vector2 dims(r - l, t - b);
        
        // アスペクト比を維持しながらスケールを計算
        double scale_val;
        if (dims.x * frame.y < dims.y * frame.x) {
            translate_vec.x = 0.5 * (frame.x / frame.y * dims.y - dims.x) - l;
            translate_vec.y = -b;
            scale_val = frame.y / dims.y;
        } else {
            translate_vec.x = -l;
            translate_vec.y = 0.5 * (frame.y / frame.x * dims.x - dims.y) - b;
            scale_val = frame.x / dims.x;
        }
        
        scale_vec.x = scale_val;
        scale_vec.y = scale_val;
        
        // pxRangeに基づいてトランスレーションを調整（余白を確保するため加算）
        translate_vec.x += pxRange / scale_val;
        translate_vec.y += pxRange / scale_val;
        
        emscripten_console_logf("C++: Auto-frame: scale=%.4f, translate=(%.4f, %.4f)", 
            scale_val, translate_vec.x, translate_vec.y);
        
        // エッジカラーリング
        edgeColoringSimple(shape, 3.0);
        emscripten_console_log("C++: Edge coloring complete");
        
        // MSDF生成（公式と同じProjection + Rangeを使用）
        Bitmap<float, 3> msdf(width, height);
        Projection projection(scale_vec, translate_vec);
        Range range_obj(pxRange / min(scale_vec.x, scale_vec.y));
        SDFTransformation transformation(projection, range_obj);
        
        generateMSDF(msdf, shape, transformation);
        emscripten_console_log("C++: MSDF generation complete");
        
        // RGBAバッファに変換
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int idx = (y * width + x) * 4;
                
                // MSDFの3チャンネル(RGB)を取得
                float r = msdf(x, y)[0];
                float g = msdf(x, y)[1];
                float b = msdf(x, y)[2];
                
                // 0.5を中心に0-1の範囲を0-255に変換
                output[idx + 0] = (unsigned char)(clamp(r, 0.0f, 1.0f) * 255.0f);
                output[idx + 1] = (unsigned char)(clamp(g, 0.0f, 1.0f) * 255.0f);
                output[idx + 2] = (unsigned char)(clamp(b, 0.0f, 1.0f) * 255.0f);
                output[idx + 3] = 255; // Alpha
            }
        }
        
        emscripten_console_log("C++: Conversion to RGBA complete");
        
        // 最初の数バイトを確認
        emscripten_console_logf("C++: First pixel RGBA: %d, %d, %d, %d", 
            output[0], output[1], output[2], output[3]);
        emscripten_console_logf("C++: Center pixel RGBA: %d, %d, %d, %d", 
            output[(height/2*width+width/2)*4+0], 
            output[(height/2*width+width/2)*4+1], 
            output[(height/2*width+width/2)*4+2], 
            output[(height/2*width+width/2)*4+3]);
        
        return 1;
        
    } catch (const std::exception& e) {
        emscripten_console_logf("C++: Exception: %s", e.what());
        return 0;
    } catch (...) {
        emscripten_console_log("C++: Unknown exception");
        return 0;
    }
}

}
