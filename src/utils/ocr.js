import { createWorker } from 'tesseract.js';

export async function startFullScreenOCR(imageData, langs = ['eng', 'chi_sim']) {
  const dataURL = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
  const worker = await createWorker(
    langs,
    {
      corePath: `${window.location.origin}/_assets/tesseract-core.wasm`,
      workerPath: `${window.location.origin}/_assets/worker.min.js`,
      langPath: `${window.location.origin}/tessdata`,
      gzip: false,
    }
  );
  const { data: { text } } = await worker.recognize(dataURL);
  await worker.terminate();
  console.log('OCR Result:', text);
  return text;
}
