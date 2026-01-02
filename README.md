# MSDFGen On Browser

Based on [msdfgen](https://github.com/Chlumsky/msdfgen) by Viktor Chlumský.

This repository provides a WebAssembly port for use in web browsers.

## Features

- **Official Library**: Based on the original C++ source code compiled to WASM via Emscripten.
- **Auto-Frame Support**: Includes the same scaling and translation logic as the official command-line tool (`-autoframe`).
- **Client-Side Only**: MSDF generation is performed entirely in the browser.
- **Verified Consistency**: The output is verified to match the official CLI tool. It performs the equivalent of the following command:
  ```bash
  msdfgen.exe msdf -svg "input.svg" -o "output_msdf.png" -size {width} {height} -pxrange {pxrange} -autoframe
  ```

## Project Structure

- `index.html`, `app.js`: Web interface and controller logic.
- `public/msdfgen.js`, `public/msdfgen.wasm`: Pre-compiled WebAssembly binaries.
- `src/`:
    - `wasm_wrapper.cpp`: C++ bridge for the WASM export.
    - `build.bat`: Build script for the Emscripten compiler.

## Usage

You can test the latest version online at:
https://osakishoukai.github.io/MSDFGen-OnBrowser/

1. Clone this repository.
2. Serve the root directory with any HTTP server (e.g., `npx serve` or `python -m http.server`).
3. Open the page in your browser.
4. Drag and drop an SVG file containing a `<path>` element.
5. Click "MSDFを生成" (Generate MSDF) and download the result.

## Limitations

- **Single Path Recommended**: For best results, use SVG files with a single `<path>` element. Multiple separate paths may not be processed correctly, matching the behavior of the official `msdfgen` CLI (`-svg` option processes only the last path).
- To convert multi-path SVGs, use vector editing software (Inkscape, Illustrator) to merge paths before processing.

## Building from Source

To modify the C++ wrapper or recompile the binaries:

1. Install [Emscripten](https://emscripten.org/).
2. Clone the original [Chlumsky/msdfgen](https://github.com/Chlumsky/msdfgen) repository at the same level as this project.
3. Execute `src/build.bat`.

## License

MIT License. See the original [msdfgen](https://github.com/Chlumsky/msdfgen) repository for library-specific license terms.
