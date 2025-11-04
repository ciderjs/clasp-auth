import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function run() {
  const home = os.homedir();
  const clasprcPath = path.join(home, ".clasprc.json");
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
  fs.writeFileSync(clasprcPath, JSON.stringify(data, null, 2));
  console.log(`\u2705 Wrote ${clasprcPath}`);
}
run();
