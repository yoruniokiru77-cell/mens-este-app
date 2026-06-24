// @ts-nocheck
// UI ユーティリティ — モーダル・クリップボード・確認ダイアログ

export function _showModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.cssText = el.style.cssText.replace('display:none', 'display:block');
  el.style.display = 'block';
  const inner = el.querySelector(':scope > div');
  if (inner) {
    inner.style.margin = 'auto';
    inner.style.position = 'relative';
  }
  el.scrollTop = 0;
  void el.getBoundingClientRect();
}

export function _hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

export async function _copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch(e) { /* fallthrough */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const range = document.createRange();
  range.selectNodeContents(ta);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  ta.setSelectionRange(0, 999999);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  return ok;
}

export function _confirm(message, okLabel = 'OK', cancelLabel = 'キャンセル') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:14px;padding:24px;max-width:320px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
        <div style="font-size:14px;color:var(--text);margin-bottom:20px;line-height:1.6;white-space:pre-line">${message}</div>
        <div style="display:flex;gap:10px">
          <button id="_confirm-ok" style="flex:1;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">${okLabel}</button>
          <button id="_confirm-cancel" style="flex:1;padding:10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;font-size:14px;cursor:pointer">${cancelLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_confirm-ok').onclick    = () => { document.body.removeChild(overlay); resolve(true);  };
    overlay.querySelector('#_confirm-cancel').onclick = () => { document.body.removeChild(overlay); resolve(false); };
  });
}
