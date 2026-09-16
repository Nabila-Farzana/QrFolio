// Shared helpers for the generator page and the profile page.
(function (global) {
  'use strict';

  const FIELDS = ['name', 'title', 'company', 'phone', 'email', 'website', 'address', 'bio', 'notes'];

  // Short keys keep the data in the QR link small.
  const SHORT = {
    name: 'n', title: 't', company: 'c', phone: 'p',
    email: 'e', website: 'w', address: 'a', bio: 'b', notes: 'i',
  };

  const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];

  // Accepts the short form (from a link) and the long form (from the form fields).
  function normalize(data) {
    const profile = { files: [] };
    if (!data || typeof data !== 'object') return profile;
    FIELDS.forEach((field) => {
      const value = data[SHORT[field]] ?? data[field];
      profile[field] = typeof value === 'string' ? value.trim() : '';
    });
    const files = data.f || data.files;
    if (Array.isArray(files)) {
      files.forEach((item) => {
        const file = Array.isArray(item)
          ? { label: item[0], url: item[1] }
          : { label: item && item.label, url: item && item.url };
        if (typeof file.url === 'string' && file.url.trim()) {
          profile.files.push({ label: String(file.label || '').trim(), url: file.url.trim() });
        }
      });
    }
    return profile;
  }

  function toShort(profile) {
    const out = {};
    FIELDS.forEach((field) => { if (profile[field]) out[SHORT[field]] = profile[field]; });
    if (profile.files.length) out.f = profile.files.map((file) => [file.label, file.url]);
    return out;
  }

  // Base64url of the UTF-8 JSON, so that the data is safe in a URL fragment.
  function encode(profile) {
    const bytes = new TextEncoder().encode(JSON.stringify(toShort(profile)));
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(text) {
    let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
    return normalize(JSON.parse(new TextDecoder().decode(bytes)));
  }

  const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

  function normalizeWebsite(value) {
    const text = (value || '').trim();
    if (!text) return '';
    return HAS_SCHEME.test(text) ? text : 'https://' + text;
  }

  // Returns an absolute http, https, mailto, or tel URL. Returns null for other schemes.
  function safeUrl(value, base) {
    let text = (value || '').trim();
    if (!text) return null;
    // "www.example.com/x" or "drive.google.com/x" without a scheme is a web address.
    if (!HAS_SCHEME.test(text) && /^(www\.|[\w-]+(\.[\w-]+)+\/)/i.test(text)) text = 'https://' + text;
    try {
      const url = new URL(text, base);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  // A file must live in the storage of its owner. This site hosts no files,
  // so a link to this site itself is not a design file.
  function fileUrl(value) {
    const url = safeUrl(value);
    if (!url || !/^https?:/i.test(url)) return null;
    try {
      if (new URL(url).origin === location.origin) return null;
    } catch (error) {
      return null;
    }
    return url;
  }

  function fileKind(url) {
    let path = url;
    try { path = new URL(url).pathname; } catch (error) { /* keep the raw value */ }
    const ext = (path.split('.').pop() || '').toLowerCase();
    if (IMAGE_EXT.includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'link';
  }

  function driveFileId(url) {
    const match = /^https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/.exec(url);
    return match ? match[1] : null;
  }

  // Returns an image address for the preview, or null when no preview is possible.
  function previewUrl(url) {
    const driveId = driveFileId(url);
    // Google Drive gives a thumbnail for public images and PDFs.
    if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
    if (fileKind(url) !== 'image') return null;
    try {
      const parsed = new URL(url);
      // A Dropbox share link opens a web page. "raw=1" gives the image itself.
      if (/(^|\.)dropbox\.com$/.test(parsed.hostname)) {
        parsed.searchParams.delete('dl');
        parsed.searchParams.set('raw', '1');
        return parsed.href;
      }
    } catch (error) { /* use the link as it is */ }
    return url;
  }

  function escapeVcard(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/[,;]/g, (char) => '\\' + char);
  }

  function vcard(profile) {
    const parts = profile.name.split(/\s+/).filter(Boolean);
    const last = parts.length > 1 ? parts.pop() : '';
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    lines.push(`N:${escapeVcard(last)};${escapeVcard(parts.join(' '))};;;`);
    lines.push('FN:' + escapeVcard(profile.name));
    if (profile.company) lines.push('ORG:' + escapeVcard(profile.company));
    if (profile.title) lines.push('TITLE:' + escapeVcard(profile.title));
    if (profile.phone) lines.push('TEL;TYPE=CELL:' + escapeVcard(profile.phone));
    if (profile.email) lines.push('EMAIL;TYPE=INTERNET:' + escapeVcard(profile.email));
    if (profile.website) lines.push('URL:' + normalizeWebsite(profile.website));
    if (profile.address) lines.push('ADR;TYPE=WORK:;;' + escapeVcard(profile.address) + ';;;;');
    const note = [profile.bio, profile.notes].filter(Boolean).join('\n');
    if (note) lines.push('NOTE:' + escapeVcard(note));
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  // Throws when the text is too long for a QR code.
  function makeQR(text, level) {
    global.qrcode.stringToBytes = global.qrcode.stringToBytesFuncs['UTF-8'];
    const qr = global.qrcode(0, level || 'M');
    qr.addData(text, 'Byte');
    qr.make();
    return qr;
  }

  const QUIET_ZONE = 4;

  function drawCanvas(qr, canvas, color, size) {
    const count = qr.getModuleCount();
    const total = count + QUIET_ZONE * 2;
    const cell = Math.max(1, Math.floor(size / total));
    canvas.width = canvas.height = cell * total;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + QUIET_ZONE) * cell, (row + QUIET_ZONE) * cell, cell, cell);
        }
      }
    }
  }

  function toSvg(qr, color) {
    const count = qr.getModuleCount();
    const total = count + QUIET_ZONE * 2;
    let path = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
      `<rect width="100%" height="100%" fill="#ffffff"/><path fill="${color}" d="${path}"/></svg>\n`;
  }

  function download(filename, blob) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  global.QRProfile = {
    FIELDS, normalize, encode, decode, normalizeWebsite, safeUrl, fileUrl, fileKind, driveFileId, previewUrl,
    vcard, makeQR, drawCanvas, toSvg, download,
  };
})(typeof window !== 'undefined' ? window : globalThis);
