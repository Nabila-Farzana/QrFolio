(function () {
  'use strict';

  const Q = window.QRProfile;
  const app = document.getElementById('app');

  // All text goes in with textContent, because the data comes from the URL.
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'className') node.className = value;
      else node.setAttribute(key, value);
    });
    (children || []).forEach((child) => { if (child) node.appendChild(child); });
    return node;
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
  }

  function action(label, href, primary) {
    if (!href) return null;
    const external = /^https?:/.test(href);
    return el('a', {
      className: 'btn' + (primary ? '' : ' ghost'),
      href,
      target: external ? '_blank' : null,
      rel: external ? 'noopener' : null,
      text: label,
    });
  }

  function fileCard(file) {
    const url = Q.fileUrl(file.url);
    if (!url) return null;
    const kind = Q.fileKind(url);
    let label = file.label;
    if (!label) {
      const name = url.split(/[?#]/)[0].split('/').pop();
      try { label = decodeURIComponent(name); } catch (error) { label = name; }
    }
    label = label || 'File';
    const card = el('a', { className: 'file-card', href: url, target: '_blank', rel: 'noopener' });

    let iconText = 'LINK';
    if (kind === 'pdf') iconText = 'PDF';
    else if (kind === 'image') iconText = 'IMAGE';
    else if (Q.driveFileId(url)) iconText = 'FILE';
    const icon = () => el('div', { className: 'thumb-icon', text: iconText });

    // Show a preview when one is available. Show the icon when the preview fails.
    const src = Q.previewUrl(url);
    let thumb = icon();
    if (src) {
      thumb = el('img', { src, alt: label, loading: 'lazy', referrerpolicy: 'no-referrer' });
      thumb.addEventListener('error', () => thumb.replaceWith(icon()));
    }
    card.appendChild(el('div', { className: 'thumb' }, [thumb]));
    card.appendChild(el('span', { className: 'file-label', text: label }));
    return card;
  }

  function render(profile) {
    if (!profile.name) throw new Error('The profile has no name.');
    document.title = profile.name + (profile.title ? ' | ' + profile.title : '');

    const subtitle = [profile.title, profile.company].filter(Boolean).join(', ');
    const phone = profile.phone.replace(/[^\d+]/g, '');
    const website = Q.safeUrl(Q.normalizeWebsite(profile.website));

    const saveButton = el('button', { type: 'button', className: 'btn ghost', text: 'Save contact' });
    saveButton.addEventListener('click', () => {
      const blob = new Blob([Q.vcard(profile)], { type: 'text/vcard' });
      Q.download((profile.name.replace(/[^\w-]+/g, '_') || 'contact') + '.vcf', blob);
    });

    const header = el('section', { className: 'card profile-head' }, [
      el('div', { className: 'avatar', text: initials(profile.name), 'aria-hidden': 'true' }),
      el('div', {}, [
        el('h1', { text: profile.name }),
        subtitle ? el('p', { className: 'subtitle', text: subtitle }) : null,
        profile.address ? el('p', { className: 'address', text: profile.address }) : null,
      ]),
    ]);

    const actions = el('div', { className: 'actions' }, [
      action('Call', phone ? 'tel:' + phone : null, true),
      action('Email', profile.email ? 'mailto:' + encodeURIComponent(profile.email).replace('%40', '@') : null),
      action('Website', website),
      saveButton,
    ]);
    header.appendChild(actions);

    const sections = [header];
    if (profile.bio) {
      sections.push(el('section', { className: 'card' }, [el('p', { className: 'bio', text: profile.bio })]));
    }

    const cards = profile.files.map(fileCard).filter(Boolean);
    if (cards.length) {
      sections.push(el('section', { className: 'card' }, [
        el('h2', { text: 'Designs' }),
        el('div', { className: 'file-grid' }, cards),
      ]));
    }

    app.replaceChildren(...sections);
  }

  function showError(message) {
    app.replaceChildren(el('section', { className: 'card' }, [
      el('h1', { text: 'Profile not found' }),
      el('p', { className: 'hint', text: message }),
    ]));
  }

  async function load() {
    // The QR link holds all of the profile data. The site stores no profiles.
    const hash = location.hash.slice(1);
    if (!hash) throw new Error('Scan a profile QR code to see a profile.');
    return Q.decode(hash);
  }

  load().then(render).catch((error) => {
    showError(error instanceof SyntaxError || error.name === 'InvalidCharacterError'
      ? 'The QR link is not valid.'
      : error.message || 'The QR link is not valid.');
  });
  window.addEventListener('hashchange', () => location.reload());
})();
