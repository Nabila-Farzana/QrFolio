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

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // The LinkedIn brand mark.
  const LINKEDIN_PATH = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 '
    + '2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 '
    + '7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 '
    + '1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 '
    + '1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z';

  function brandIcon(path) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'btn-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(SVG_NS, 'path');
    shape.setAttribute('d', path);
    shape.setAttribute('fill', 'currentColor');
    svg.appendChild(shape);
    return svg;
  }

  function action(label, href, options) {
    if (!href) return null;
    const settings = options || {};
    const external = /^https?:/.test(href);
    const button = el('a', {
      className: 'btn' + (settings.primary ? '' : ' ghost'),
      href,
      target: external ? '_blank' : null,
      rel: external ? 'noopener' : null,
    });
    if (settings.icon) button.appendChild(settings.icon);
    button.appendChild(el('span', { text: label }));
    return button;
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
    else if (kind === 'image') iconText = 'IMG';
    else if (Q.driveFileId(url)) iconText = 'FILE';
    const icon = () => el('span', { className: 'file-badge', text: iconText });

    // Show a small preview when one is available. Show the badge when the preview fails.
    const src = Q.previewUrl(url);
    let thumb = icon();
    if (src) {
      thumb = el('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      thumb.addEventListener('error', () => thumb.replaceWith(icon()));
    }

    const type = kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : '';
    const source = [Q.sourceName(url), type].filter(Boolean).join(' · ');
    card.appendChild(el('span', { className: 'file-thumb' }, [thumb]));
    card.appendChild(el('span', { className: 'file-text' }, [
      el('span', { className: 'file-title', text: label }),
      source ? el('span', { className: 'file-sub', text: source }) : null,
    ]));
    card.appendChild(arrow());
    return card;
  }

  function arrow() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'file-go');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M9 5l7 7-7 7');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  // A phone opens a mail app for a "mailto:" link. A computer often does nothing,
  // so a computer gets a small menu with the web mail services.
  function isTouchDevice() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  function menuItem(label, href) {
    return el('a', { className: 'menu-item', href, target: '_blank', rel: 'noopener', text: label });
  }

  function emailAction(email) {
    if (!email) return null;
    const address = encodeURIComponent(email);
    const mailto = 'mailto:' + address.replace('%40', '@');
    if (isTouchDevice()) return action('Email', mailto);

    const button = el('button', {
      type: 'button', className: 'btn ghost', 'aria-expanded': 'false', 'aria-haspopup': 'true', text: 'Email',
    });
    const copyItem = el('button', { type: 'button', className: 'menu-item', text: 'Copy address' });
    const menu = el('div', { className: 'menu', hidden: 'hidden' }, [
      menuItem('Gmail', 'https://mail.google.com/mail/?view=cm&fs=1&to=' + address),
      menuItem('Outlook', 'https://outlook.office.com/mail/deeplink/compose?to=' + address),
      copyItem,
    ]);
    const wrap = el('span', { className: 'menu-wrap' }, [button, menu]);

    function close() {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      button.setAttribute('aria-expanded', String(!menu.hidden));
    });
    copyItem.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(email);
        copyItem.textContent = 'Copied';
      } catch (error) {
        copyItem.textContent = email;
      }
      setTimeout(() => { copyItem.textContent = 'Copy address'; close(); }, 1200);
    });
    menu.addEventListener('click', (event) => { if (event.target.tagName === 'A') close(); });
    document.addEventListener('click', close);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    return wrap;
  }

  function render(profile) {
    if (!profile.name) throw new Error('The profile has no name.');
    document.title = profile.name + (profile.title ? ' | ' + profile.title : '');

    const subtitle = [profile.title, profile.company].filter(Boolean).join(', ');
    const phone = profile.phone.replace(/[^\d+]/g, '');
    const website = Q.safeUrl(Q.normalizeWebsite(profile.website));
    const linkedin = Q.safeUrl(Q.linkedinUrl(profile.linkedin));

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
      action('Call', phone ? 'tel:' + phone : null, { primary: true }),
      emailAction(profile.email),
      action('Website', website),
      action('LinkedIn', linkedin, { icon: brandIcon(LINKEDIN_PATH) }),
      saveButton,
    ]);
    header.appendChild(actions);

    const sections = [header];
    if (profile.bio) {
      sections.push(el('section', { className: 'card' }, [el('p', { className: 'bio', text: profile.bio })]));
    }

    if (profile.notes) {
      sections.push(el('section', { className: 'card' }, [
        el('h2', { text: 'More information' }),
        el('p', { className: 'bio', text: profile.notes }),
      ]));
    }

    const cards = profile.files.map(fileCard).filter(Boolean);
    if (cards.length) {
      sections.push(el('section', { className: 'card' }, [
        el('h2', { text: 'Attachments' }),
        el('div', { className: 'file-list' }, cards),
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
