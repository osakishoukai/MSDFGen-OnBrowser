let msdfModule = null;
let currentSvgData = null;
let currentFileName = '';
// 開発用フラグ: 自動読み込み・期待結果表示を有効にする
const DEV_MODE = false;

const elements = {
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    status: document.getElementById('status'),
    downloadBtn: document.getElementById('downloadBtn'),
    output: document.getElementById('output'),
    svgPreview: document.getElementById('svgPreview'),
    msdfCanvas: document.getElementById('msdfCanvas'),
    width: document.getElementById('width'),
    height: document.getElementById('height'),
    pxRange: document.getElementById('pxRange'),
    similarityScore: document.getElementById('similarityScore'),
    similarityValue: document.getElementById('similarityValue'),
    inputLabel: document.getElementById('inputLabel'),
    decodedCanvas: document.getElementById('decodedCanvas'),
    aspectLockBtn: document.getElementById('aspectLockBtn')
};

// ステータス表示
function showStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.className = type;
}

// WASM初期化
async function initWasm() {
    try {
        showStatus('WebAssembly読み込み中...', 'info');
        
        const script = document.createElement('script');
        script.src = 'public/msdfgen.js';
        script.onload = async () => {
            msdfModule = await createMsdfgenModule();
            showStatus('準備完了！', 'success');
            // 開発モードなら自動でSVGを読み込み、期待結果を表示してMSDFを実行
            if (DEV_MODE) {
                await loadDevSvg();
            } else {
                showStatus('SVGファイルをアップロードしてください。', 'success');
            }
        };
        script.onerror = () => {
            showStatus('エラー: WebAssemblyの読み込みに失敗しました', 'error');
        };
        document.head.appendChild(script);
        
    } catch (error) {
        showStatus('エラー: ' + error.message, 'error');
        console.error(error);
    }
}

// 開発用: ローカルのテストSVGを自動で読み込む
async function loadDevSvg() {
    try {
        showStatus('開発モード: ロゴSVGを読み込み中...', 'info');

        // 開発用に public 配下にコピーしたSVGを参照
        const svgPath = 'public/logo.svg';
        const resp = await fetch(svgPath);
        if (!resp.ok) {
            showStatus('エラー: テストSVGの読み込みに失敗しました (' + resp.status + ')', 'error');
            return;
        }

        const svgText = await resp.text();
        currentSvgData = svgText;
        currentFileName = 'logo';

        displayExpectedPngPreview();

        showStatus('テストSVG読み込み完了。MSDF生成中...', 'success');
        // 自動でMSDF生成
        await generateMsdfImage();

    } catch (err) {
        console.error(err);
        showStatus('エラー: ' + err.message, 'error');
    }
}

// テストSVGを自動読み込み
async function loadTestSvg() {
    const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 16 16" fill="none">
<path d="M6 7L7 6L4.70711 3.70711L5.19868 3.21553C5.97697 2.43724 7.03256 2 8.13323 2C11.361 2 14 4.68015 14 7.93274C14 11.2589 11.3013 14 8 14C6.46292 14 4.92913 13.4144 3.75736 12.2426L2.34315 13.6569C3.90505 15.2188 5.95417 16 8 16C12.4307 16 16 12.3385 16 7.93274C16 3.60052 12.4903 0 8.13323 0C6.50213 0 4.93783 0.647954 3.78447 1.80132L3.29289 2.29289L1 0L0 1V7H6Z" fill="#000000"/>
</svg>`;
    
    currentSvgData = testSvg;
    currentFileName = 'arrow-rotate-left-svgrepo-com';
    displaySvgPreview(testSvg);
    
    showStatus('テストSVG読み込み完了！MSDFを生成します...', 'success');
    generateMsdfImage();
}

// ファイル読み込み
function loadSvgFile(file) {
    if (!file || !file.type.includes('svg')) {
        showStatus('エラー: SVGファイルを選択してください', 'error');
        return;
    }

    currentFileName = file.name.replace('.svg', '');
    const reader = new FileReader();
    reader.onload = (e) => {
        currentSvgData = e.target.result;
        displaySvgPreview(currentSvgData);
        showStatus('SVG読み込み完了！MSDFを生成します...', 'success');
        generateMsdfImage();
    };
    reader.readAsText(file);
}

// SVGプレビュー表示
function displaySvgPreview(svgData) {
    elements.svgPreview.innerHTML = svgData;
    // placeholderを隠すなどの処理はCSSでも制御可能だが、ここでは単純に上書きされる
}

async function displayExpectedPreview(svgText) {
    // SVG から PNG を生成して表示する (開発用。ブラウザ内生成)
    try {
        const width = parseInt(elements.width.value) || 512;
        const height = parseInt(elements.height.value) || 512;
        const pngDataUrl = await svgToPngDataUrl(svgText, width, height);
        elements.svgPreview.innerHTML = `<img id="expectedResult" src="${pngDataUrl}" alt="期待される結果">`;
        elements.output.style.display = 'grid';
    } catch (err) {
        console.error('displayExpectedPreview error:', err);
        // フォールバック: SVGを直接埋めるのではなく、data:URIで<img>にして表示する
        try {
            const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
            elements.svgPreview.innerHTML = `<img id="expectedResult" src="${svgDataUrl}" alt="期待される結果">`;
        } catch (e) {
            // 最終手段としてプレーンなSVGを埋める（稀にのみ）
            console.error('fallback image render failed:', e);
            elements.svgPreview.innerHTML = svgText;
        }
        elements.output.style.display = 'grid';
    }
}

// 直接PNGを表示する（開発用）。既存の TESTDATA の PNG を参照する
function displayExpectedPngPreview() {
    // public 配下にコピーした PNG を参照する
    const imgSrc = 'public/logo_msdf_original.png';
    elements.svgPreview.innerHTML = `<img id="expectedResult" src="${imgSrc}" alt="期待される結果">`;
    elements.output.style.display = 'grid';
}

function svgToPngDataUrl(svgText, width, height) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Ensure proper encoding of SVG
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                // Fill white background to avoid transparent background issues
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                // Draw SVG image scaled to canvas
                ctx.drawImage(img, 0, 0, width, height);
                const pngDataUrl = canvas.toDataURL('image/png');
                URL.revokeObjectURL(url);
                resolve(pngDataUrl);
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(new Error('SVG image load failed'));
        };
        img.src = url;
    });
}


// MSDF生成
async function generateMsdfImage() {
    if (!msdfModule) {
        showStatus('エラー: WebAssemblyがまだ読み込まれていません', 'error');
        return;
    }

    if (!currentSvgData) {
        showStatus('エラー: SVGファイルが読み込まれていません', 'error');
        return;
    }

    try {
        showStatus('MSDF生成中...', 'info');

        const width = parseInt(elements.width.value);
        const height = parseInt(elements.height.value);
        const pxRange = parseFloat(elements.pxRange.value);

        // SVGからpath要素のd属性を抽出（transform適用済み）
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(currentSvgData, 'image/svg+xml');
        const pathElement = svgDoc.querySelector('path');
        
        if (!pathElement) {
            showStatus('エラー: SVGにpath要素が見つかりません', 'error');
            return;
        }
        
        // 親要素のtransformを再帰的に収集
        function collectTransforms(element) {
            let transforms = [];
            let current = element;
            while (current && current.nodeType === 1) {
                const transform = current.getAttribute('transform');
                if (transform) {
                    transforms.unshift(transform); // 親が先に来るように
                }
                current = current.parentElement;
            }
            return transforms;
        }
        
        // 変換行列を計算してパスを変換
        function transformPathData(pathData, transforms) {
            if (!transforms.length) return pathData;
            
            // 一時的なSVG要素を作成してパスを描画し、変換を適用
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.position = 'absolute';
            svg.style.visibility = 'hidden';
            svg.setAttribute('width', '1000');
            svg.setAttribute('height', '1000');
            
            // transformをネストしたg要素で再現
            let current = svg;
            for (const t of transforms) {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', t);
                current.appendChild(g);
                current = g;
            }
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            current.appendChild(path);
            
            document.body.appendChild(svg);
            
            // getCTMを使用して変換行列を取得
            const ctm = path.getCTM();
            
            if (!ctm) {
                console.warn('Could not get CTM, returning original path');
                document.body.removeChild(svg);
                return pathData;
            }
            
            // SVGパスの座標を解析して変換
            // パスコマンドのパターンにマッチ
            const result = [];
            let currentX = 0, currentY = 0;
            let startX = 0, startY = 0;
            
            // パスデータをトークン化
            const tokens = pathData.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
            let i = 0;
            
            function parseNumber() {
                return parseFloat(tokens[i++]);
            }
            
            function transformPoint(x, y) {
                const pt = svg.createSVGPoint();
                pt.x = x;
                pt.y = y;
                const transformed = pt.matrixTransform(ctm);
                return { x: transformed.x, y: transformed.y };
            }
            
            while (i < tokens.length) {
                const cmd = tokens[i++];
                
                switch (cmd) {
                    case 'M': case 'm': {
                        const isRelative = cmd === 'm';
                        const x = parseNumber();
                        const y = parseNumber();
                        const absX = isRelative ? currentX + x : x;
                        const absY = isRelative ? currentY + y : y;
                        const tp = transformPoint(absX, absY);
                        result.push(`M ${tp.x},${tp.y}`);
                        currentX = absX;
                        currentY = absY;
                        startX = currentX;
                        startY = currentY;
                        // M後の連続座標はLとして扱う
                        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
                            const nx = parseNumber();
                            const ny = parseNumber();
                            const nabsX = isRelative ? currentX + nx : nx;
                            const nabsY = isRelative ? currentY + ny : ny;
                            const ntp = transformPoint(nabsX, nabsY);
                            result.push(`L ${ntp.x},${ntp.y}`);
                            currentX = nabsX;
                            currentY = nabsY;
                        }
                        break;
                    }
                    case 'L': case 'l': {
                        const isRelative = cmd === 'l';
                        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
                            const x = parseNumber();
                            const y = parseNumber();
                            const absX = isRelative ? currentX + x : x;
                            const absY = isRelative ? currentY + y : y;
                            const tp = transformPoint(absX, absY);
                            result.push(`L ${tp.x},${tp.y}`);
                            currentX = absX;
                            currentY = absY;
                        }
                        break;
                    }
                    case 'H': case 'h': {
                        const isRelative = cmd === 'h';
                        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
                            const x = parseNumber();
                            const absX = isRelative ? currentX + x : x;
                            const tp = transformPoint(absX, currentY);
                            result.push(`L ${tp.x},${tp.y}`);
                            currentX = absX;
                        }
                        break;
                    }
                    case 'V': case 'v': {
                        const isRelative = cmd === 'v';
                        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
                            const y = parseNumber();
                            const absY = isRelative ? currentY + y : y;
                            const tp = transformPoint(currentX, absY);
                            result.push(`L ${tp.x},${tp.y}`);
                            currentY = absY;
                        }
                        break;
                    }
                    case 'C': case 'c': {
                        const isRelative = cmd === 'c';
                        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
                            const x1 = parseNumber(), y1 = parseNumber();
                            const x2 = parseNumber(), y2 = parseNumber();
                            const x = parseNumber(), y = parseNumber();
                            const ax1 = isRelative ? currentX + x1 : x1;
                            const ay1 = isRelative ? currentY + y1 : y1;
                            const ax2 = isRelative ? currentX + x2 : x2;
                            const ay2 = isRelative ? currentY + y2 : y2;
                            const ax = isRelative ? currentX + x : x;
                            const ay = isRelative ? currentY + y : y;
                            const tp1 = transformPoint(ax1, ay1);
                            const tp2 = transformPoint(ax2, ay2);
                            const tp = transformPoint(ax, ay);
                            result.push(`C ${tp1.x},${tp1.y} ${tp2.x},${tp2.y} ${tp.x},${tp.y}`);
                            currentX = ax;
                            currentY = ay;
                        }
                        break;
                    }
                    case 'Z': case 'z':
                        result.push('Z');
                        currentX = startX;
                        currentY = startY;
                        break;
                    default:
                        // その他のコマンドは近似的に処理
                        console.warn(`Unhandled path command: ${cmd}`);
                        break;
                }
            }
            
            document.body.removeChild(svg);
            return result.join(' ');
        }
        const transforms = collectTransforms(pathElement);
        let pathData = pathElement.getAttribute('d');
        
        // transformがある場合は適用
        if (transforms.length > 0) {
            console.log('Applying transforms:', transforms);
            pathData = transformPathData(pathData, transforms);
        }
        
        console.log('Path data:', pathData.substring(0, 100) + '...');

        // メモリ確保
        const bufferSize = width * height * 4;
        const bufferPtr = msdfModule._malloc(bufferSize);
        
        // パスデータ文字列をC++に渡すためのメモリ確保
        const pathDataLength = pathData.length + 1;
        const pathDataPtr = msdfModule._malloc(pathDataLength);
        
        // 文字列をWASMメモリに書き込む
        for (let i = 0; i < pathData.length; i++) {
            msdfModule.HEAPU8[pathDataPtr + i] = pathData.charCodeAt(i);
        }
        msdfModule.HEAPU8[pathDataPtr + pathData.length] = 0; // null終端
        
        console.log('Calling generate_msdf_from_svg...');
        console.log('Width:', width, 'Height:', height, 'PxRange:', pxRange);
        
        // WASM関数呼び出し
        const result = msdfModule._generate_msdf_from_svg(
            width, 
            height, 
            pathDataPtr,
            pxRange,
            bufferPtr
        );
        
        console.log('Result:', result);
        
        // パスデータのメモリを解放
        msdfModule._free(pathDataPtr);
        
        if (result === 1) {
            // .slice() ではなく .subarray() を使うことで不要なメモリコピーを避ける
            const buffer = msdfModule.HEAPU8.subarray(bufferPtr, bufferPtr + bufferSize);
            
            console.log('Buffer length:', buffer.length);
            console.log('First few bytes:', buffer.slice(0, 20));
            
            // キャンバスに描画
            const canvas = elements.msdfCanvas;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            const imgData = ctx.createImageData(width, height);
            imgData.data.set(buffer);
            ctx.putImageData(imgData, 0, 0);
            
            elements.downloadBtn.disabled = false;
            showStatus('MSDF生成完了！🎉', 'success');
            
            // 復号サンプルを表示
            decodeMsdf();
            
            // 一致度の計算
            setTimeout(() => {
                updateSimilarity();
            }, 100);
        } else {
            showStatus('エラー: MSDF生成に失敗しました (result: ' + result + ')', 'error');
        }
        
        // メモリ解放
        msdfModule._free(bufferPtr);
        
    } catch (error) {
        showStatus('エラー: ' + error.message, 'error');
        console.error('Full error:', error);
    } finally {
        // 必要に応じて処理を追加
    }
}





// MSDFを復号してサンプル表示（固定サイズで高品質表示）
function decodeMsdf() {
    const msdfCanvas = elements.msdfCanvas;
    const decodedCanvas = elements.decodedCanvas;
    
    if (!msdfCanvas.width || !msdfCanvas.height) {
        return;
    }
    
    const srcWidth = msdfCanvas.width;
    const srcHeight = msdfCanvas.height;
    
    // 固定サイズで復号（MSDFの利点を示すため）
    const dstSize = 512; // 常に512x512で表示
    const dstWidth = dstSize;
    const dstHeight = dstSize;
    const scale = dstSize / Math.max(srcWidth, srcHeight);
    
    // 復号結果のキャンバスを準備
    decodedCanvas.width = dstWidth;
    decodedCanvas.height = dstHeight;
    
    const msdfCtx = msdfCanvas.getContext('2d', { willReadFrequently: true });
    const decodedCtx = decodedCanvas.getContext('2d');
    
    const msdfData = msdfCtx.getImageData(0, 0, srcWidth, srcHeight);
    const decodedData = decodedCtx.createImageData(dstWidth, dstHeight);
    
    // バイリニア補間でMSDFをサンプリングして2倍サイズに復号
    for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
            // ソース座標（小数点）
            const srcX = x / scale;
            const srcY = y / scale;
            
            // バイリニア補間用の4点
            const x0 = Math.floor(srcX);
            const y0 = Math.floor(srcY);
            const x1 = Math.min(x0 + 1, srcWidth - 1);
            const y1 = Math.min(y0 + 1, srcHeight - 1);
            
            const fx = srcX - x0;
            const fy = srcY - y0;
            
            // 4点のピクセルを取得
            function getPixel(px, py) {
                const idx = (py * srcWidth + px) * 4;
                return {
                    r: msdfData.data[idx] / 255.0,
                    g: msdfData.data[idx + 1] / 255.0,
                    b: msdfData.data[idx + 2] / 255.0
                };
            }
            
            const p00 = getPixel(x0, y0);
            const p10 = getPixel(x1, y0);
            const p01 = getPixel(x0, y1);
            const p11 = getPixel(x1, y1);
            
            // バイリニア補間
            function lerp(a, b, t) {
                return a + (b - a) * t;
            }
            
            const r = lerp(lerp(p00.r, p10.r, fx), lerp(p01.r, p11.r, fx), fy);
            const g = lerp(lerp(p00.g, p10.g, fx), lerp(p01.g, p11.g, fx), fy);
            const b = lerp(lerp(p00.b, p10.b, fx), lerp(p01.b, p11.b, fx), fy);
            
            // 中央値を計算
            const median = Math.max(Math.min(r, g), Math.min(Math.max(r, g), b));
            
            const distance = median - 0.5;
            const pxRange = parseFloat(elements.pxRange.value) || 3;
            const screenPxDistance = distance * pxRange * scale;
            
            // アンチエイリアス: -0.5〜+0.5ピクセルの範囲で滑らかに
            const opacity = Math.max(0, Math.min(1, screenPxDistance + 0.5));
            
            // 白背景に黒い形状を描画（直接RGB値で設定）
            const value = Math.round(255 * (1 - opacity)); // 0=黒, 255=白
            
            const dstIdx = (y * dstWidth + x) * 4;
            decodedData.data[dstIdx] = value;       // R
            decodedData.data[dstIdx + 1] = value;   // G
            decodedData.data[dstIdx + 2] = value;   // B
            decodedData.data[dstIdx + 3] = 255;     // A (完全不透明)
        }
    }
    
    decodedCtx.putImageData(decodedData, 0, 0);
}


function downloadMsdf() {
    const canvas = elements.msdfCanvas;
    
    if (!canvas.width || !canvas.height) {
        showStatus('エラー: 生成された画像がありません', 'error');
        return;
    }
    
    const baseName = (currentFileName || 'msdf_output').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = baseName + '_msdf.png';
    
    canvas.toBlob((blob) => {
        if (!blob) {
            showStatus('エラー: 画像の変換に失敗しました', 'error');
            return;
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('ダウンロード完了: ' + filename, 'success');
    }, 'image/png', 1.0);
}



// イベントリスナー設定
function setupEventListeners() {
    elements.uploadArea.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) loadSvgFile(file);
    });

    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) loadSvgFile(file);
    });

    // 縦横比ロックのロジック
    let isAspectLocked = true;
    let aspectRatio = 1.0;

    function updateAspectRatio() {
        const w = parseInt(elements.width.value);
        const h = parseInt(elements.height.value);
        if (w > 0 && h > 0) {
            aspectRatio = w / h;
        }
    }

    elements.aspectLockBtn.addEventListener('click', () => {
        isAspectLocked = !isAspectLocked;
        elements.aspectLockBtn.classList.toggle('active', isAspectLocked);
        elements.aspectLockBtn.querySelector('.lock-icon').textContent = isAspectLocked ? '🔒' : '🔓';
        if (isAspectLocked) {
            updateAspectRatio();
        }
    });

    elements.width.addEventListener('input', () => {
        if (isAspectLocked) {
            const w = parseInt(elements.width.value);
            if (w > 0) {
                elements.height.value = Math.round(w / aspectRatio);
            }
        }
        generateMsdfImage();
    });

    elements.height.addEventListener('input', () => {
        if (isAspectLocked) {
            const h = parseInt(elements.height.value);
            if (h > 0) {
                elements.width.value = Math.round(h * aspectRatio);
            }
        }
        generateMsdfImage();
    });

    elements.pxRange.addEventListener('input', generateMsdfImage);
    elements.downloadBtn.addEventListener('click', downloadMsdf);
}

// 一致度の計算 (ユーザー提供のロジック)
function calculateImageSimilarity(canvas1, canvas2) {
    const ctx1 = canvas1.getContext('2d', { willReadFrequently: true });
    const ctx2 = canvas2.getContext('2d', { willReadFrequently: true });
    
    // サイズが異なる場合は不一致
    if (canvas1.width !== canvas2.width || canvas1.height !== canvas2.height) {
        console.warn('Similarity check: Canvas sizes differ', canvas1.width, 'x', canvas1.height, 'vs', canvas2.width, 'x', canvas2.height);
        return 0;
    }
    
    const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;
    const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;
    
    let matchingPixels = 0;
    const totalPixels = data1.length / 4; // RGBAなので4で割る
    
    for (let i = 0; i < data1.length; i += 4) {
        const r1 = data1[i], g1 = data1[i+1], b1 = data1[i+2], a1 = data1[i+3];
        const r2 = data2[i], g2 = data2[i+1], b2 = data2[i+2], a2 = data2[i+3];
        
        if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) {
            matchingPixels++;
        }
    }
    
    return (matchingPixels / totalPixels) * 100;
}

// 期待される結果と生成されたMSDFを比較して表示を更新
async function updateSimilarity() {
    if (!DEV_MODE) return;
    const expectedImg = document.getElementById('expectedResult');
    if (!expectedImg || !elements.msdfCanvas) {
        elements.similarityScore.style.display = 'none';
        return;
    }

    // 画像の読み込み完了を待つ (<img> の場合)
    if (expectedImg.tagName === 'IMG' && !expectedImg.complete) {
        await new Promise(resolve => {
            expectedImg.onload = resolve;
            expectedImg.onerror = resolve;
        });
    }

    const width = elements.msdfCanvas.width;
    const height = elements.msdfCanvas.height;

    // 期待される結果を比較用のキャンバスに描画
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    
    // 背景を白で塗りつぶす (生成結果が不透明なら不要だが、念の為)
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, width, height);
    
    // 画像を描画
    tempCtx.drawImage(expectedImg, 0, 0, width, height);
    
    const similarity = calculateImageSimilarity(tempCanvas, elements.msdfCanvas);
    elements.similarityValue.textContent = similarity.toFixed(2);
    elements.similarityScore.style.display = 'block';
}

// 初期化
setupEventListeners();
initWasm();
