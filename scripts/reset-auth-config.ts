import fs from "fs";
import path from "path";
import readline from "readline";

async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n🔒 This script will reset the following auth configuration:");
  console.log("- Google authentication provider (if enabled)");
  console.log("- GitHub authentication provider (if enabled)");
  console.log("- SMS two-factor authentication (if enabled)");
  console.log(
    "\nOther settings like email/password auth, authenticator app 2FA,"
  );
  console.log("and backup codes will remain unchanged.");

  return new Promise((resolve) => {
    rl.question("\nAre you sure you want to proceed? (y/N) ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function resetAuthConfig() {
  try {
    const shouldProceed = await confirmReset();

    if (!shouldProceed) {
      console.log("❌ Operation cancelled");
      process.exit(0);
    }

    console.log("\n🔒 Resetting auth configuration...");

    // Read the current auth config
    const configPath = path.join(process.cwd(), "src", "config", "auth.ts");
    let configContent = fs.readFileSync(configPath, "utf8");

    // Disable providers using regex replacements
    configContent = configContent
      // Disable Google
      .replace(/(google:\s*{\s*enabled:\s*)true/, "$1false")
      // Disable GitHub
      .replace(/(github:\s*{\s*enabled:\s*)true/, "$1false")
      // Disable SMS 2FA
      .replace(/(sms:\s*{[^}]+enabled:\s*)true/, "$1false");

    // Write the modified config back
    fs.writeFileSync(configPath, configContent, "utf8");

    console.log("✅ Auth configuration has been reset!");
    console.log("\nChanges made:");
    console.log("- Disabled all social providers");
    console.log("- Disabled SMS 2FA");
    console.log("\nConfiguration file updated at:", configPath);
  } catch (error) {
    console.error("❌ Failed to reset auth configuration:", error);
    process.exit(1);
  }
}

resetAuthConfig();
