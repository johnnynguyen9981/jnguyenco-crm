// One-time script: creates Chloe Mackrell + her booking in Supabase
// Run with:  node create-client-chloe.js
const https = require("https");

const SUPABASE_URL = "https://outgfozwoktqtendezaq.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dGdmb3p3b2t0cXRlbmRlemFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg3NTYxMSwiZXhwIjoyMDk2NDUxNjExfQ.ymVQgnm5kG1NJOLqsmCOwm5sfB5Wnuklv9gE3ijyPkY";
const OWNER_ID     = "168ed15e-61c1-4202-9abc-e0eabcd7eb1a";

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "outgfozwoktqtendezaq.supabase.co",
      path,
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer":        "return=representation",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("Creating client: Chloe Mackrell...");

  // 1. Create client
  const clientRes = await post("/rest/v1/clients", {
    owner_id:        OWNER_ID,
    first_name:      "Chloe",
    last_name:       "Mackrell",
    email:           "chloewentworth2016@gmail.com",
    phone:           "0431173009",
    address:         "7 Jaques Place Evatt ACT 2617",
    referral_source: "FACEBOOK",
  });

  if (clientRes.status !== 201) {
    console.error("❌ Client creation failed:", JSON.stringify(clientRes.data, null, 2));
    process.exit(1);
  }

  const client = Array.isArray(clientRes.data) ? clientRes.data[0] : clientRes.data;
  console.log("✅ Client created:", client.id);

  // 2. Create booking
  const bookingRes = await post("/rest/v1/bookings", {
    owner_id:         OWNER_ID,
    client_id:        client.id,
    service_type:     "EVENT",
    status:           "INQUIRY",
    event_date:       "2026-09-06",
    event_start_time: "12:00",
    event_end_time:   "14:00",
    venue_name:       "7 Jaques Place Evatt",
    venue_address:    "ACT 2617",
    quoted_total:     null,
    special_requests: "Husband's 30th birthday surprise. Focus on capturing his reaction and mingling. Two dogs possible but not essential. Kate cutting a group shot if possible. Please ignore requests for separate family shots — keep focus on the husband. Photography only (hourly). Est. 20-30 guests.",
    internal_notes:   "Package interest: Hourly Photography $150/hr. Budget: Under $1,000. Event: 6 Sep 2026, 12:00-14:00 (2 hours).",
  });

  if (bookingRes.status !== 201) {
    console.error("❌ Booking creation failed:", JSON.stringify(bookingRes.data, null, 2));
    console.log("   Client was created OK — go to /clients/" + client.id + " to add booking manually.");
    process.exit(1);
  }

  const booking = Array.isArray(bookingRes.data) ? bookingRes.data[0] : bookingRes.data;
  console.log("✅ Booking created:", booking.id);
  console.log("");
  console.log("🎉 Done! Open your CRM and go to:");
  console.log("   http://localhost:3000/clients/" + client.id);
}

main().catch(console.error);
