const fs = require('fs');
const envFile = fs.readFileSync('packages/twenty-docker/.env', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) process.env[match[1]] = match[2].replace(/(^['"]|['"]$)/g, '').trim();
});
const ORIGIN = process.env.SERVER_URL || 'http://localhost:3001';

async function run() {
  const loginRes = await fetch(ORIGIN + "/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation getLoginTokenFromCredentials($email: String!, $password: String!, $origin: String!) {
        getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) {
          loginToken { token }
        }
      }`,
      variables: { email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD, origin: ORIGIN }
    })
  });
  const loginToken = (await loginRes.json()).data.getLoginTokenFromCredentials.loginToken.token;
  
  const tokenRes = await fetch(ORIGIN + "/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation getAuthTokensFromLoginToken($loginToken: String!, $origin: String!) {
        getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
          tokens { accessOrWorkspaceAgnosticToken { token } }
        }
      }`,
      variables: { loginToken, origin: ORIGIN }
    })
  });
  const token = (await tokenRes.json()).data.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;

  const res = await fetch(ORIGIN + "/rest/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ name: "Test Corp", domainName: { primaryLinkUrl: "testcorp.com", primaryLinkLabel: "testcorp.com" } })
  });
  console.log(await res.json());
}
run();
