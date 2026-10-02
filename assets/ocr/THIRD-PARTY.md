# Local OCR dependencies

These files are hosted with the app. The selected picture is never sent to
these projects or to an OCR API.

- `tesseract.min.js` and `worker.min.js`: Tesseract.js 6.0.1,
  https://github.com/naptha/tesseract.js, Apache-2.0 (`LICENSE.md`).
- `core/`: Tesseract.js-core 6.0.0, LSTM and SIMD-LSTM builds,
  https://github.com/naptha/tesseract.js-core, Apache-2.0 (`core/LICENSE`).
  The `.wasm.js` distributions embed their WebAssembly payloads.
- `lang/eng.traineddata.gz` and `lang/fra.traineddata.gz`: English and French
  integer/fast trained data from https://tessdata.projectnaptha.com/4.0.0_fast/,
  Tesseract language data, Apache-2.0 (`lang/LICENSE`).

Only the selected core is downloaded on a device. Assets are cached lazily by
the service worker after their first successful download. Do not replace them
without bumping `OCR_CACHE_NAME` in `service-worker.js`.
