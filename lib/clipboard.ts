/**
 * Copies text to the clipboard.
 * Tries the modern async Clipboard API first; falls back to the legacy
 * document.execCommand('copy') approach which works on iOS < 13.4 and
 * any browser where the async API is unavailable or blocked.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern path — async Clipboard API (iOS 13.4+, Android, all desktop)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Falls through to legacy path
    }
  }

  // Legacy path — works in older Safari / iOS WebViews
  try {
    const el = document.createElement('textarea');
    el.value = text;
    // Keep it off-screen but selectable
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
