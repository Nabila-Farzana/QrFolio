// The generator keeps no data. The QR code and the edit link hold all of the profile data.
(function () {
  'use strict';

  const Q = window.QRProfile;
  const PREVIEW_SIZE = 640;
  const EXPORT_SIZE = 1200;

  const form = document.getElementById('form');
  const filesBox = document.getElementById('files');
  const rowTemplate = document.getElementById('file-row');
  const canvas = document.getElementById('qr');
  const info = document.getElementById('qr-info');
  const warnings = document.getElementById('qr-warn');
  const colorInput = document.getElementById('fg');
  const levelInput = document.getElementById('ecl');
  const openLink = document.getElementById('open-profile');
  const pngButton = document.getElementById('dl-png');
  const svgButton = document.getElementById('dl-svg');
  const editButton = document.getElementById('copy-edit');

  // The pages next to this page. The fragment and query of this page are not kept.
  const profileBase = new URL('profile.html', location.href).href;
  const editBase = new URL('index.html', location.href).href;

  let current = null;

  function addFileRow(file) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('.f-label').value = (file && file.label) || '';
    row.querySelector('.f-url').value = (file && file.url) || '';
    row.querySelector('.remove').addEventListener('click', () => {
      row.remove();
      update();
    });
    filesBox.appendChild(row);
    return row;
  }

  function readProfile() {
    const data = new FormData(form);
    const raw = { files: [] };
    Q.FIELDS.forEach((field) => { raw[field] = String(data.get(field) || ''); });
    filesBox.querySelectorAll('.file-row').forEach((row) => {
      raw.files.push({ label: row.querySelector('.f-label').value, url: row.querySelector('.f-url').value });
    });
    return Q.normalize(raw);
  }

  function isLightColor(hex) {
    const value = parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
  }

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  }

  // A QR code without a name and one contact is of no use to the person who scans it.
  function missingParts(profile) {
    const missing = [];
    if (!profile.name) missing.push('Write the full name.');
    if (!profile.phone && !profile.email && !profile.website) {
      missing.push('Give at least one contact: a phone number, an email address, or a website.');
    }
    return missing;
  }

  function update() {
    const profile = readProfile();
    const mode = form.elements.mode.value;
    const encoded = Q.encode(profile);
    const text = mode === 'vcard' ? Q.vcard(profile) : profileBase + '#' + encoded;

    const messages = missingParts(profile);
    if (messages.length) {
      current = null;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      info.textContent = 'The QR code starts here.';
      showMessages(messages);
      setButtons(false, mode);
      return;
    }
    try {
      current = { qr: Q.makeQR(text, levelInput.value), text, profile, editLink: editBase + '#' + encoded };
    } catch (error) {
      current = null;
    }

    if (current) {
      Q.drawCanvas(current.qr, canvas, colorInput.value, PREVIEW_SIZE);
      const count = current.qr.getModuleCount();
      info.textContent = `${text.length} characters, grid of ${count} by ${count}.`;
      if (count > 77) messages.push('The QR code is dense. Print it at 4 cm or larger, or remove some text.');
    } else {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      info.textContent = '';
      messages.push('The data is too long for a QR code. Remove some text or some files.');
    }

    // This site hosts no files. Every file must stay in the storage of its owner.
    if (profile.files.some((file) => !/^https:\/\//i.test(file.url))) {
      messages.push('Each file link must start with "https://". This site does not store files.');
    }
    if (mode === 'vcard' && profile.files.length) {
      messages.push('A contact card cannot hold attachments. Choose the profile page type to show them.');
    }
    if (location.protocol === 'file:') {
      messages.push('This page runs from a local file. Open it from the GitHub Pages address before you print the QR code.');
    }
    if (isLightColor(colorInput.value)) messages.push('Use a dark color. Scanners cannot read light QR codes well.');

    showMessages(messages);
    openLink.href = mode === 'vcard' ? '#' : text;
    setButtons(Boolean(current), mode);
  }

  function showMessages(messages) {
    warnings.replaceChildren(...messages.map((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      return item;
    }));
    warnings.hidden = messages.length === 0;
  }

  function setButtons(ready, mode) {
    pngButton.disabled = svgButton.disabled = editButton.disabled = !ready;
    openLink.hidden = mode === 'vcard';
    openLink.classList.toggle('is-disabled', !ready);
  }

  // An edit link (index.html#data) fills the form again. Nothing comes from storage.
  function loadFromLink() {
    let profile = null;
    const hash = location.hash.slice(1);
    if (hash) {
      try { profile = Q.decode(hash); } catch (error) { profile = null; }
    }
    if (profile) {
      Q.FIELDS.forEach((field) => { form.elements[field].value = profile[field]; });
      profile.files.forEach(addFileRow);
    }
    if (!filesBox.children.length) addFileRow();
    // Remove the data from the address bar, so that a reload gives an empty form.
    if (hash) history.replaceState(null, '', location.pathname + location.search);
  }

  document.getElementById('add-file').addEventListener('click', () => {
    addFileRow().querySelector('.f-label').focus();
  });

  form.addEventListener('input', update);
  form.addEventListener('submit', (event) => event.preventDefault());
  colorInput.addEventListener('input', update);
  levelInput.addEventListener('change', update);

  pngButton.addEventListener('click', () => {
    if (!current) return;
    const exportCanvas = document.createElement('canvas');
    Q.drawCanvas(current.qr, exportCanvas, colorInput.value, EXPORT_SIZE);
    exportCanvas.toBlob((blob) => Q.download(slug(current.profile.name) + '-qr.png', blob), 'image/png');
  });

  svgButton.addEventListener('click', () => {
    if (!current) return;
    const blob = new Blob([Q.toSvg(current.qr, colorInput.value)], { type: 'image/svg+xml' });
    Q.download(slug(current.profile.name) + '-qr.svg', blob);
  });

  editButton.addEventListener('click', async () => {
    if (!current) return;
    const label = editButton.textContent;
    try {
      await navigator.clipboard.writeText(current.editLink);
      editButton.textContent = 'Link copied';
    } catch (error) {
      prompt('Copy this edit link:', current.editLink);
    }
    setTimeout(() => { editButton.textContent = label; }, 1500);
  });

  // The button id must not be "reset", because a form control shadows form.reset.
  document.getElementById('clear-form').addEventListener('click', () => {
    form.reset();
    filesBox.replaceChildren();
    addFileRow();
    update();
  });

  // Used by pickers.js. Fills empty rows first, then adds new rows.
  function addFiles(files) {
    files.forEach((file) => {
      const empty = [...filesBox.querySelectorAll('.file-row')]
        .find((row) => !row.querySelector('.f-label').value && !row.querySelector('.f-url').value);
      if (empty) {
        empty.querySelector('.f-label').value = file.label;
        empty.querySelector('.f-url').value = file.url;
      } else {
        addFileRow(file);
      }
    });
    update();
  }

  window.QRGenerator = { addFiles };

  loadFromLink();
  update();
})();
