/**
 * Saving the clip to the phone.
 *
 * Android Chrome downloads a blob: URL straight into Downloads, which is
 * what we want. The Web Share API is offered alongside it because sharing
 * directly into TikTok or Instagram skips a round trip through the gallery.
 */

export function canShareFiles(file) {
  try {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

export function makeFile(blob, name, mimeType) {
  try {
    return new File([blob], name, { type: mimeType || blob.type });
  } catch {
    return null;   // File constructor is missing on some old WebViews
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late: a download that hasn't started yet still needs the URL.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function shareFile(file, title) {
  await navigator.share({ files: [file], title });
}

export function buildFilename(baseName, preset, extension) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `${baseName}-${preset}-${stamp}.${extension}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
