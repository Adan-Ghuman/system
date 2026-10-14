import { api } from './api.js';
import { downloadFilename, saveBlob } from './fileDownload.js';

const downloads = new Map<string, Promise<void>>();

export function downloadExcelReport(url: string, fallbackFilename: string): Promise<void> {
  if (downloads.has(url)) return downloads.get(url)!;
  const request = (async () => {
    try {
      const response = await api.get<Blob>(url, { responseType: 'blob' });
      const blob = response.data;
      const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) {
        throw new Error('The report was not a valid Excel file. Please try again.');
      }
      saveBlob(blob, downloadFilename(response.headers['content-disposition'], fallbackFilename));
    } catch (error) {
      const failure = error as { response?: { data?: Blob }; message?: string };
      let message = failure.message || 'The report could not be downloaded. Please try again.';
      if (failure.response?.data instanceof Blob) {
        try {
          const data = JSON.parse(await failure.response.data.text()) as { error?: string; message?: string };
          message = data.error || data.message || message;
        } catch { message = failure.message || message; }
      }
      throw new Error(message);
    }
  })().finally(() => downloads.delete(url));
  downloads.set(url, request);
  return request;
}
