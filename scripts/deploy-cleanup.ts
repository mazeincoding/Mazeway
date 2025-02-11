import { execSync } from "child_process";

console.log("🚀 Deploying cleanup function...");

try {
  // Check if Supabase CLI works
  try {
    execSync("npx supabase projects list", { stdio: "ignore" });
  } catch (error) {
    console.log("\n❌ Error accessing Supabase CLI!");
    console.log("\nThis could be because:");
    console.log("1. You're not logged in (run: npx supabase login)");
    console.log("2. Network connectivity issues");
    console.log("\nTry these steps:");
    console.log("1. Run: npx supabase login");

    console.log("2. If that doesn't work, try: npm install supabase --global");
    console.log("3. If still having issues, check your internet connection");
    console.log("4. Then run this script again: npm run deploy:cleanup");
    process.exit(1);
  }

  // Deploy the function
  execSync("npx supabase functions deploy cleanup-expired-sessions", {
    stdio: "inherit",
  });

  console.log("✅ Cleanup function deployed successfully!");
  console.log("\nNext steps:");
  console.log(
    "1. Set up environment variables at: https://supabase.com/dashboard/project/_/settings/functions",
  );
  console.log(
    "2. Create a CRON schedule at: https://supabase.com/dashboard/project/_/database/hooks",
  );
} catch (error) {
  console.error("❌ Error deploying cleanup function:", error);
  if (error instanceof Error) {
    console.error("Error details:", error.message);
  }
  process.exit(1);
}
