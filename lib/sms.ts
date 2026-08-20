// lib/sms.ts
// Minimal Twilio SMS helper -- plain fetch against Twilio's REST API (Basic
// Auth with Account SID + Auth Token), no SDK dependency needed for a
// single "send one text" use case like a new-enquiry alert.
//
// One-time setup (done by you, not Claude -- account creation and payment
// details are things Claude won't handle on your behalf):
//   1. Create a Twilio account at twilio.com and buy a phone number
//      (~US$1/month + a few cents per SMS).
//   2. In the Vercel dashboard -> Settings -> Environment Variables, add:
//        TWILIO_ACCOUNT_SID   -- from the Twilio Console
//        TWILIO_AUTH_TOKEN    -- from the Twilio Console
//        TWILIO_FROM_NUMBER   -- the Twilio number you bought, E.164 format (e.g. +61491570156)
//        OWNER_MOBILE_NUMBER  -- your own mobile, E.164 format (e.g. +61426864865)
//   3. Redeploy so the new env vars take effect.
function stripBOM(s: string | undefined): string {
  if (!s) return "";
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

export function isSmsConfigured(): boolean {
  const env = process.env as Record<string, string | undefined>;
  return !!(
    stripBOM(env["TWILIO_ACCOUNT_SID"]) &&
    stripBOM(env["TWILIO_AUTH_TOKEN"]) &&
    stripBOM(env["TWILIO_FROM_NUMBER"])
  );
}

export async function sendSms(to: string, body: string): Promise<void> {
  const env = process.env as Record<string, string | undefined>;
  const sid   = stripBOM(env["TWILIO_ACCOUNT_SID"]);
  const token = stripBOM(env["TWILIO_AUTH_TOKEN"]);
  const from  = stripBOM(env["TWILIO_FROM_NUMBER"]);

  if (!sid || !token || !from) {
    throw new Error("Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER).");
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twilio SMS failed (${res.status}): ${text.slice(0, 300)}`);
  }
}
