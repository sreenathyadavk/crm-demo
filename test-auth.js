async function run() {
  const origin = "http://localhost:3001";
  
  const loginRes = await fetch(origin + "/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation getLoginTokenFromCredentials($email: String!, $password: String!, $origin: String!) {
        getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) {
          loginToken { token }
        }
      }`,
      variables: { email: "sreenathyadavk@gmail.com", password: "Twenty123!", origin }
    })
  });
  const loginData = await loginRes.json();
  const loginToken = loginData.data?.getLoginTokenFromCredentials?.loginToken?.token;
  
  const tokenRes = await fetch(origin + "/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation getAuthTokensFromLoginToken($loginToken: String!, $origin: String!) {
        getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
          tokens {
            accessOrWorkspaceAgnosticToken { token }
          }
        }
      }`,
      variables: { loginToken, origin }
    })
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.data?.getAuthTokensFromLoginToken?.tokens?.accessOrWorkspaceAgnosticToken?.token;
  
  const companyRes = await fetch(origin + "/rest/companies", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken
    },
    body: JSON.stringify({
      name: "Green Farm",
      domainName: "greenfarm.com"
    })
  });
  const companyData = await companyRes.json();
  console.log("Company:", companyData);
}
run();
