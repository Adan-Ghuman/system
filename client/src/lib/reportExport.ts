import { api } from './api.js';

/**
 * Downloads a generated .xlsx report from the server and prompts standard browser save
 */
export async function downloadExcelReport(url: string, fallbackFilename: string): Promise<void> {
  try {
    const response = await api.get(url, {
      responseType: 'blob'
    });

    let filename = fallbackFilename;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err: any) {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        throw new Error(json.error || 'Failed to generate Excel report');
      } catch {
        // keep original error
      }
    }
    throw err;
  }
}
