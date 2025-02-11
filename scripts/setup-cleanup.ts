import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const functionCode = `import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("PROJECT_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false
        }
      }
    )

    const { error } = await supabase
      .from("device_sessions")
      .delete()
      .lt("expires_at", new Date().toISOString())

    if (error) {
      console.error("Failed to clean up expired sessions:", error)
      throw error
    }

    console.log("Successfully cleaned up expired sessions")
    return new Response(
      JSON.stringify({ message: "Cleanup successful" }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Error during cleanup:", error)
    return new Response(
      JSON.stringify({ error: "Failed to clean up expired sessions" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})`;

console.log("🚀 Setting up cleanup function...");

try {
  // Check if Supabase CLI works
  try {
    execSync("npx supabase projects list", { stdio: "ignore" });
  } catch (error) {
    console.log("\n❌ Error accessing Supabase CLI!");
    console.log("\nThis could be because:");
    console.log("1. You're not logged in (run: npx supabase login)");
    console.log("2. Supabase CLI isn't installed properly");
    console.log("3. Network connectivity issues");
    console.log("\nTry these steps:");
    console.log("1. Run: npx supabase login");
    console.log("2. If that doesn't work, try: npm install supabase --global");
    console.log("3. If still having issues, check your internet connection");
    console.log("4. Then run this script again: npm run setup:cleanup");
    process.exit(1);
  }

  // Define the function directory path
  const functionDir = path.join(
    process.cwd(),
    "supabase",
    "functions",
    "cleanup-expired-sessions"
  );

  // Check if the function already exists
  if (existsSync(functionDir)) {
    console.log("📝 Cleanup function already exists, updating code...");
    // Just update the code file
    writeFileSync(path.join(functionDir, "index.ts"), functionCode);
  } else {
    // Create new function if it doesn't exist
    console.log("Creating Supabase function...");
    execSync("npx supabase functions new cleanup-expired-sessions", {
      stdio: "inherit",
    });

    // Create the function directory if it doesn't exist
    mkdirSync(functionDir, { recursive: true });

    // Write the function code
    console.log("Writing function code...");
    writeFileSync(path.join(functionDir, "index.ts"), functionCode);
  }

  console.log("✅ Cleanup function setup complete!");
  console.log("\nNext step:");
  console.log();
  console.log("run: npm run deploy:cleanup");
} catch (error) {
  console.error("❌ Error setting up cleanup function:", error);
  if (error instanceof Error) {
    console.error("Error details:", error.message);
  }
  process.exit(1);
}
