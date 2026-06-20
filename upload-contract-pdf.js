// One-time script: uploads General_Photography_Contract.pdf to Supabase Documents storage
const fs = require("fs");
const https = require("https");
const path = require("path");

const SUPABASE_URL   = "https://outgfozwoktqtendezaq.supabase.co";
const SERVICE_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dGdmb3p3b2t0cXRlbmRlemFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg3NTYxMSwiZXhwIjoyMDk2NDUxNjExfQ.ymVQgnm5kG1NJOLqsmCOwm5sfB5Wnuklv9gE3ijyPkY";
const BUCKET         = "documents";
const OWNER_ID       = "168ed15e-61c1-4202-9abc-e0eabcd7eb1a";
const FILE_NAME      = "General_Photography_Contract.pdf";
const FILE_PATH      = path.join(__dirname, FILE_NAME);

function req(method, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + urlPath);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const r = https.request(opts, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

async function run() {
  // 1. Ensure bucket exists
  console.log("Checking bucket...");
  const listRes = await req("GET", "/storage/v1/bucket", {
    "Authorization": `Bearer ${SERVICE_KEY}`,
  });
  const buckets = JSON.parse(listRes.body);
  const exists = Array.isArray(buckets) && buckets.find(b => b.id === BUCKET);

  if (!exists) {
    console.log("Creating bucket...");
    const createRes = await req("POST", "/storage/v1/bucket", {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    }, JSON.stringify({ id: BUCKET, name: BUCKET, public: false }));
    console.log("Bucket create:", createRes.status, createRes.body);
  } else {
    console.log("Bucket already exists.");
  }

  // 2. Upload file
  const fileBuffer = fs.readFileSync(FILE_PATH);
  const storagePath = `/storage/v1/object/${BUCKET}/${OWNER_ID}/${FILE_NAME}`;
  console.log(`Uploading ${FILE_NAME} (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);

  const uploadRes = await req("POST", storagePath, {
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/pdf",
    "Content-Length": fileBuffer.length,
    "x-upsert": "true",
  }, fileBuffer);

  if (uploadRes.status === 200 || uploadRes.status === 201) {
    console.log("✓ Upload successful!");
    console.log("  File will appear in Documents → General_Photography_Contract.pdf");
  } else {
    console.error("✗ Upload failed:", uploadRes.status, uploadRes.body);
  }
}

run().catch(console.error);
