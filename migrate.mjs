// One-time migration: adds partner columns to clients table
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://outgfozwoktqtendezaq.supabase.co",
  // service role key — has permission to run DDL
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dGdmb3p3b2t0cXRlbmRlemFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg3NTYxMSwiZXhwIjoyMDk2NDUxNjExfQ.ymVQgnm5kG1NJOLqsmCOwm5sfB5Wnuklv9gE3ijyPkY"
);

const { error } = await supabase.rpc("exec_sql", {
  sql: `
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS partner_first  text,
      ADD COLUMN IF NOT EXISTS partner_last   text,
      ADD COLUMN IF NOT EXISTS partner_email  text,
      ADD COLUMN IF NOT EXISTS partner_phone  text;
  `
});

if (error) {
  // exec_sql RPC may not exist — print manual instructions
  console.error("RPC not available. Please run this SQL in the Supabase SQL Editor:");
  console.log(`
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS partner_first  text,
  ADD COLUMN IF NOT EXISTS partner_last   text,
  ADD COLUMN IF NOT EXISTS partner_email  text,
  ADD COLUMN IF NOT EXISTS partner_phone  text;
  `);
} else {
  console.log("Migration successful! Partner columns added to clients table.");
}
