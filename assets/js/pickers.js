// Optional buttons that add share links from Google Drive or Dropbox.
// The page loads the Google or Dropbox scripts only after a person clicks that button.
// The Google access token stays in memory only. The page saves nothing.
(function () {
  'use strict';

  const config = window.QR_CONFIG || {};
  const googleConfig = config.google || {};
  const generator = window.QRGenerator;
  const status = document.getElementById('picker-status');
  const driveButton = document.getElementById('pick-drive');
  const dropboxButton = document.getElementById('pick-dropbox');

  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const DRIVE_TYPES = 'application/pdf,image/png,image/jpeg,image/gif,image/webp,image/svg+xml';

  const scripts = {};

  function loadScript(src, attrs) {
    if (!scripts[src]) {
      scripts[src] = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        Object.entries(attrs || {}).forEach(([key, value]) => script.setAttribute(key, value));
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => {
          delete scripts[src];
          reject(new Error(`The page cannot load ${new URL(src).host}. Check the internet connection or an ad blocker.`));
        };
        document.head.appendChild(script);
      });
    }
    return scripts[src];
  }

  function setStatus(message, isError) {
    status.textContent = message || '';
    status.classList.toggle('error', Boolean(isError));
    status.hidden = !message;
  }

  function withoutExtension(name) {
    return String(name || '').replace(/\.[^.]+$/, '');
  }

  function plural(count) {
    return count === 1 ? '1 file' : `${count} files`;
  }

  // Loads the scripts on the first click, then continues.
  function guarded(button, ready, choose) {
    let isReady = false;
    button.addEventListener('click', async () => {
      if (isReady) {
        choose();
        return;
      }
      button.disabled = true;
      setStatus('Loading...');
      try {
        await ready();
        isReady = true;
        setStatus('');
        choose();
      } catch (error) {
        setStatus(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
    button.hidden = false;
  }

  // Dropbox

  function dropboxReady() {
    return loadScript('https://www.dropbox.com/static/api/2/dropins.js', {
      id: 'dropboxjs',
      'data-app-key': config.dropboxAppKey,
    });
  }

  function chooseDropbox() {
    if (!window.Dropbox.isBrowserSupported()) {
      setStatus('Dropbox does not support this browser. Paste a share link.', true);
      return;
    }
    window.Dropbox.choose({
      linkType: 'preview', // A "direct" link stops after 4 hours, so use a share link.
      multiselect: true,
      extensions: ['.pdf', 'images'],
      success: (files) => {
        generator.addFiles(files.map((file) => ({ label: withoutExtension(file.name), url: file.link })));
        setStatus(`Added ${plural(files.length)} from Dropbox. Dropbox made a share link for each file.`);
      },
    });
    setStatus('If no Dropbox window opens, let pop-ups for this site and click again.');
  }

  // Google Drive

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiry = 0;

  function googleReady() {
    const picker = loadScript('https://apis.google.com/js/api.js').then(() => new Promise((resolve, reject) => {
      window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('The page cannot load Google Picker.')) });
    }));
    return Promise.all([picker, loadScript('https://accounts.google.com/gsi/client')]);
  }

  function chooseDrive() {
    if (accessToken && Date.now() < tokenExpiry) {
      showDrivePicker();
      return;
    }
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleConfig.clientId,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.error) {
            setStatus(`Google login failed: ${response.error}.`, true);
            return;
          }
          accessToken = response.access_token;
          tokenExpiry = Date.now() + (Number(response.expires_in) - 60) * 1000;
          setStatus('');
          showDrivePicker();
        },
        error_callback: (error) => {
          const message = error && error.type === 'popup_failed_to_open'
            ? 'The browser blocked the Google login window. Let pop-ups for this site and click again.'
            : 'The Google login stopped. Click again to try again.';
          setStatus(message, true);
        },
      });
    }
    tokenClient.requestAccessToken();
  }

  function showDrivePicker() {
    const picker = window.google.picker;
    const myFiles = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes(DRIVE_TYPES)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);
    const upload = new picker.DocsUploadView().setIncludeFolders(false);

    new picker.PickerBuilder()
      .addView(myFiles)
      .addView(upload)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(accessToken)
      .setDeveloperKey(googleConfig.apiKey)
      .setAppId(googleConfig.appId)
      .setCallback(onDrivePicked)
      .build()
      .setVisible(true);
  }

  async function onDrivePicked(data) {
    const picker = window.google.picker;
    if (data[picker.Response.ACTION] !== picker.Action.PICKED) return;

    const files = (data[picker.Response.DOCUMENTS] || []).map((doc) => ({
      id: doc[picker.Document.ID],
      name: doc[picker.Document.NAME],
    }));
    if (!files.length) return;

    // Changing the sharing is a real change in the person's Drive, so ask first.
    const share = confirm(
      `People who scan the QR code must be able to open ${files.length === 1 ? 'this file' : 'these files'}.\n\n` +
      `Change the sharing of ${plural(files.length)} to "Anyone with the link can view"?`
    );

    let failed = 0;
    if (share) {
      setStatus('Changing the sharing in Google Drive...');
      const results = await Promise.all(files.map((file) => shareWithLink(file.id)));
      failed = results.filter((ok) => !ok).length;
    }

    generator.addFiles(files.map((file) => ({
      label: withoutExtension(file.name),
      url: `https://drive.google.com/file/d/${file.id}/view`,
    })));

    if (!share) {
      setStatus(`Added ${plural(files.length)}. In Google Drive, share them with "Anyone with the link", or other people cannot open them.`, true);
    } else if (failed) {
      setStatus(`Added ${plural(files.length)}, but the sharing change failed for ${plural(failed)}. Change the sharing in Google Drive.`, true);
    } else {
      setStatus(`Added ${plural(files.length)} from Google Drive. Anyone with the link can now view them.`);
    }
  }

  async function shareWithLink(fileId) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        }
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Setup

  if (location.protocol === 'file:') return; // Google and Dropbox do not work from a local file.

  if (config.dropboxAppKey) guarded(dropboxButton, dropboxReady, chooseDropbox);
  if (googleConfig.apiKey && googleConfig.clientId && googleConfig.appId) {
    guarded(driveButton, googleReady, chooseDrive);
  }
})();
