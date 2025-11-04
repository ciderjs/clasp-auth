'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
const os__default = /*#__PURE__*/_interopDefaultCompat(os);
const path__default = /*#__PURE__*/_interopDefaultCompat(path);

function run() {
  const home = os__default.homedir();
  const clasprcPath = path__default.join(home, ".clasprc.json");
  const data = {
    token: {
      access_token: process.env.CLASP_ACCESS_TOKEN,
      refresh_token: process.env.CLASP_REFRESH_TOKEN,
      scope: process.env.CLASP_SCOPE,
      token_type: process.env.CLASP_TOKEN_TYPE,
      id_token: process.env.CLASP_ID_TOKEN,
      expiry_date: Number(process.env.CLASP_EXPIRY_DATE)
    },
    oauth2ClientSettings: {
      clientId: process.env.CLASP_CLIENT_ID,
      clientSecret: process.env.CLASP_CLIENT_SECRET,
      redirectUri: process.env.CLASP_REDIRECT_URI
    },
    isLocalCreds: process.env.CLASP_IS_LOCAL_CREDS === "true"
  };
  fs__default.writeFileSync(clasprcPath, JSON.stringify(data, null, 2));
  console.log(`\u2705 Wrote ${clasprcPath}`);
}
run();
