let msdfModule = null;
let currentSvgData = null;
let currentFileName = '';

const elements = {
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    status: document.getElementById('status'),
    generateBtn: document.getElementById('generateBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    outputArea: document.getElementById('outputArea'),
    svgPreview: document.getElementById('svgPreview'),
    msdfCanvas: document.getElementById('msdfCanvas'),
    width: document.getElementById('width'),
    height: document.getElementById('height'),
    pxRange: document.getElementById('pxRange')
};

function showStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.className = type;
}

// WASM Loader
async function initWasm() {
    try {
        showStatus('WebAssemblyライブラリを読み込み中...', 'info');
        
        // msdfgen.jsを読み込む
        const script = document.createElement('script');
        script.src = 'msdfgen.js';
        script.onload = async () => {
            if (typeof createMsdfgenModule === 'function') {
                msdfModule = await createMsdfgenModule();
                showStatus('準備完了！SVGをアップロードしてください。', 'success');
            } else {
                showStatus('エラー: モジュール初期化関数が見つかりません。', 'error');
            }
        };
        script.onerror = () => showStatus('エラー: msdfgen.jsの読み込みに失敗しました。', 'error');
        document.head.appendChild(script);
        
    } catch (error) {
        showStatus('エラー: ' + error.message, 'error');
        console.error(error);
    }
}

// File Handler
function loadSvgFile(file) {
    if (!file || !file.type.includes('svg')) {
        showStatus('エラー: SVGファイルを選択してください。', 'error');
        return;
    }

    currentFileName = file.name.replace('.svg', '');
    const reader = new FileReader();
    reader.onload = (e) => {
        currentSvgData = e.target.result;
        elements.svgPreview.innerHTML = currentSvgData;
        elements.outputArea.style.display = 'grid';
        elements.generateBtn.disabled = false;
        showStatus('SVG読み込み完了。', 'success');
    };
    reader.readAsText(file);
}

// Generation Logic
async function generateMsdfImage() {
    if (!msdfModule || !currentSvgData) return;

    try {
        showStatus('MSDF生成中...', 'info');
        elements.generateBtn.disabled = true;

        const width = parseInt(elements.width.value);
        const height = parseInt(elements.height.value);
        const pxRange = parseFloat(elements.pxRange.value);

        // Path Extraction
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(currentSvgData, 'image/svg+xml');
        const pathElement = svgDoc.querySelector('path');
        
        if (!pathElement) {
            showStatus('エラー: SVG内に<path>要素が見つかりませんでした。', 'error');
            return;
        }
        
        const pathData = pathElement.getAttribute('d');
        const bufferSize = width * height * 4;
        const bufferPtr = msdfModule._malloc(bufferSize);
        
        const pathDataLength = pathData.length + 1;
        const pathDataPtr = msdfModule._malloc(pathDataLength);
        
        for (let i = 0; i < pathData.length; i++) {
            msdfModule.HEAPU8[pathDataPtr + i] = pathData.charCodeAt(i);
        }
        msdfModule.HEAPU8[pathDataPtr + pathData.length] = 0;
        
        // Call WASM (Correct coordinates & Autoframe logic is inside)
        const result = msdfModule._generate_msdf_from_svg(
            width, 
            height, 
            pathDataPtr,
            pxRange,
            bufferPtr
        );
        
        msdfModule._free(pathDataPtr);
        
        if (result === 1) {
            const buffer = msdfModule.HEAPU8.subarray(bufferPtr, bufferPtr + bufferSize);
            
            const canvas = elements.msdfCanvas;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            const imgData = ctx.createImageData(width, height);
            imgData.data.set(buffer);
            ctx.putImageData(imgData, 0, 0);
            
            elements.downloadBtn.disabled = false;
            showStatus('MSDF生成完了！', 'success');
        } else {
            showStatus('エラー: MSDF生成に失敗しました。', 'error');
        }
        
        msdfModule._free(bufferPtr);
    } catch (error) {
        showStatus('エラー: ' + error.message, 'error');
    } finally {
        elements.generateBtn.disabled = false;
    }
}

// Download Handler
function downloadMsdf() {
    const canvas = elements.msdfCanvas;
    if (!canvas.width || !canvas.height) return;
    
    try {
        const filename = currentFileName ? `${currentFileName}_msdf.png` : 'msdf_output.png';
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            showStatus(`保存完了: ${filename}`, 'success');
        }, 'image/png');
    } catch (error) {
        showStatus('エラー: ' + error.message, 'error');
    }
}

// Events
function setupEventListeners() {
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) loadSvgFile(file);
    });
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });
    elements.uploadArea.addEventListener('dragleave', () => elements.uploadArea.classList.remove('dragover'));
    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) loadSvgFile(file);
    });
    elements.generateBtn.addEventListener('click', generateMsdfImage);
    elements.downloadBtn.addEventListener('click', downloadMsdf);
}

setupEventListeners();
initWasm();
