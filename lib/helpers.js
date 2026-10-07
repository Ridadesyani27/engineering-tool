function fmtNum(number, decimals = 1) {
  return Number(number).toFixed(decimals);
}

function dateStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function buildMailtoLink(email, subject, body) {
  return 'mailto:' + encodeURIComponent(email)
    + '?subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body);
}

function safeDocumentFileName(parts, fallback, extension) {
  const base = parts
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(' - ')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    || fallback;
  return `${base}.${extension.replace(/^\./, '')}`;
}

module.exports = { fmtNum, dateStamp, buildMailtoLink, safeDocumentFileName };
