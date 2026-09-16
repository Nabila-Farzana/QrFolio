// Optional settings for the file picker buttons.
// A button shows only when its settings are filled in. Leave a value empty to hide that button.
// These values are public by design. Restrict them to your site address in the Google and Dropbox consoles.
// README.md gives the setup steps.
window.QR_CONFIG = {
  // Dropbox App Console > your app > Settings > App key.
  dropboxAppKey: '',

  google: {
    // Google Cloud console > APIs & Services > Credentials > API key.
    apiKey: '',
    // Google Cloud console > APIs & Services > Credentials > OAuth 2.0 Client ID (Web application).
    clientId: '',
    // Google Cloud console > project settings > Project number.
    appId: '1024192762010',
  },
};
