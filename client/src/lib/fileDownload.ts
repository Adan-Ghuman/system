export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function downloadFilename(disposition: string | undefined, fallback: string): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { return fallback; }
  }
  return disposition?.match(/filename=(?:"([^"]+)"|([^;]+))/i)?.slice(1).find(Boolean)?.trim() || fallback;
}
