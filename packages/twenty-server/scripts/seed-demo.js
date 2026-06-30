const path = require('path');
const fs = require('fs');

// Simple dotenv parser
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../twenty-docker/.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.replace(/\\n/gm, '\n');
        }
        value = value.replace(/(^['"]|['"]$)/g, '').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
const ORIGIN = process.env.SERVER_URL || 'http://localhost:3001';

if (!EMAIL || !PASSWORD) {
  console.error("❌ DEMO_EMAIL and DEMO_PASSWORD environment variables are required.");
  process.exit(1);
}

const METADATA_ENDPOINT = `${ORIGIN}/metadata`;
const REST_ENDPOINT = `${ORIGIN}/rest`;

async function fetchGraphQL(query, variables = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(METADATA_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error("GraphQL Errors:", JSON.stringify(json.errors, null, 2));
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

async function fetchRest(path, method, token, body) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const res = await fetch(`${REST_ENDPOINT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (res.status >= 400) {
    console.error(`REST Error on ${method} ${path}:`, json);
    throw new Error(`Request failed with status ${res.status}`);
  }
  return json;
}

async function authenticate() {
  console.log("🔐 Authenticating...");
  const loginData = await fetchGraphQL(
    `mutation getLoginTokenFromCredentials($email: String!, $password: String!, $origin: String!) {
      getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) {
        loginToken { token }
      }
    }`,
    { email: EMAIL, password: PASSWORD, origin: ORIGIN }
  );

  const loginToken = loginData.getLoginTokenFromCredentials?.loginToken?.token;
  if (!loginToken) throw new Error("Failed to get login token");

  const tokenData = await fetchGraphQL(
    `mutation getAuthTokensFromLoginToken($loginToken: String!, $origin: String!) {
      getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
        tokens {
          accessOrWorkspaceAgnosticToken { token }
        }
      }
    }`,
    { loginToken, origin: ORIGIN }
  );

  const accessToken = tokenData.getAuthTokensFromLoginToken?.tokens?.accessOrWorkspaceAgnosticToken?.token;
  if (!accessToken) throw new Error("Failed to get access token");

  console.log("✅ Authentication successful.");
  return accessToken;
}

async function seedData(token) {
  const companiesData = [
    { name: "Green Farm", domainName: "greenfarm.com" },
    { name: "Apex Insurance", domainName: "apexinsurance.com" },
    { name: "Smile Dental", domainName: "smiledental.com" },
    { name: "Nova Realty", domainName: "novarealty.com" },
    { name: "Elite Restaurant", domainName: "eliterestaurant.com" },
  ];

  const peopleData = [
    { firstName: "John", lastName: "Miller", companyName: "Green Farm", email: "john@greenfarm.com", jobTitle: "Owner" },
    { firstName: "Sarah", lastName: "Johnson", companyName: "Apex Insurance", email: "sarah@apexinsurance.com", jobTitle: "Director" },
    { firstName: "Michael", lastName: "Brown", companyName: "Smile Dental", email: "michael@smiledental.com", jobTitle: "Head Dentist" },
    { firstName: "Emily", lastName: "Davis", companyName: "Nova Realty", email: "emily@novarealty.com", jobTitle: "Broker" },
    { firstName: "David", lastName: "Wilson", companyName: "Elite Restaurant", email: "david@eliterestaurant.com", jobTitle: "Manager" },
  ];

  const opportunitiesData = [
    { name: "Green Farm - POS Upgrade", companyName: "Green Farm", amount: 6000, stage: "SCREENING" },
    { name: "Apex Insurance - Automation", companyName: "Apex Insurance", amount: 18000, stage: "NEW" },
    { name: "Smile Dental - Portal", companyName: "Smile Dental", amount: 8500, stage: "PROPOSAL" },
    { name: "Nova Realty - CRM", companyName: "Nova Realty", amount: 15000, stage: "CUSTOMER" },
  ];

  console.log("🏢 Seeding Companies...");
  const companyMap = new Map();
  const existingCompaniesRes = await fetchRest('/companies', 'GET', token);
  const existingCompanies = existingCompaniesRes.data?.companies || [];
  for (const c of existingCompanies) {
    companyMap.set(c.name, c.id);
  }

  for (const c of companiesData) {
    if (companyMap.has(c.name)) {
      console.log(`   ⏭️  Company '${c.name}' already exists.`);
    } else {
      const res = await fetchRest('/companies', 'POST', token, {
        name: c.name,
        domainName: { primaryLinkUrl: c.domainName, primaryLinkLabel: c.domainName }
      });
      companyMap.set(c.name, res.data.createCompany.id);
      console.log(`   ✅ Created Company '${c.name}'`);
    }
  }

  console.log("👤 Seeding Contacts...");
  const existingPeopleRes = await fetchRest('/people', 'GET', token);
  const existingPeople = existingPeopleRes.data?.people || [];
  const peopleSet = new Set(existingPeople.map(e => `${e.name?.firstName} ${e.name?.lastName}`));

  for (const p of peopleData) {
    const fullName = `${p.firstName} ${p.lastName}`;
    if (peopleSet.has(fullName)) {
      console.log(`   ⏭️  Contact '${fullName}' already exists.`);
    } else {
      await fetchRest('/people', 'POST', token, {
        name: { firstName: p.firstName, lastName: p.lastName },
        emails: { primaryEmail: p.email },
        jobTitle: p.jobTitle,
        companyId: companyMap.get(p.companyName)
      });
      peopleSet.add(fullName);
      console.log(`   ✅ Created Contact '${fullName}'`);
    }
  }

  console.log("💼 Seeding Opportunities...");
  const existingOppsRes = await fetchRest('/opportunities', 'GET', token);
  const existingOpps = existingOppsRes.data?.opportunities || [];
  const oppsSet = new Set(existingOpps.map(e => e.name));

  for (const o of opportunitiesData) {
    if (oppsSet.has(o.name)) {
      console.log(`   ⏭️  Opportunity '${o.name}' already exists.`);
    } else {
      await fetchRest('/opportunities', 'POST', token, {
        name: o.name,
        amount: { amountMicros: o.amount * 1000000, currencyCode: "USD" },
        stage: o.stage,
        companyId: companyMap.get(o.companyName)
      });
      oppsSet.add(o.name);
      console.log(`   ✅ Created Opportunity '${o.name}'`);
    }
  }

  console.log("🎉 Seed script completed successfully!");
}

async function run() {
  try {
    const token = await authenticate();
    await seedData(token);
  } catch (err) {
    console.error("❌ Script failed:", err.message);
    process.exit(1);
  }
}

run();
