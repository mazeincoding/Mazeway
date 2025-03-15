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
  console.log("- SMS two-factor authentication (if enabled)");
  console.log("- Data export functionality (if enabled)");
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

    // Track which providers were actually disabled
    const disabledProviders: string[] = [];

    // Helper to replace and track changes
    const disableProvider = (
      content: string,
      pattern: RegExp,
      name: string
    ) => {
      const newContent = content.replace(pattern, "$1false");
      if (newContent !== content) {
        disabledProviders.push(name);
      }
      return newContent;
    };

    // Disable providers using regex replacements
    configContent = disableProvider(
      configContent,
      /(google:\s*{\s*enabled:\s*)true/,
      "Google authentication"
    );
    configContent = disableProvider(
      configContent,
      /(sms:\s*{[^}]+enabled:\s*)true/,
      "SMS two-factor authentication"
    );
    configContent = disableProvider(
      configContent,
      /(dataExport:\s*{\s*enabled:\s*)true/,
      "Data export functionality"
    );

    // Write the modified config back
    fs.writeFileSync(configPath, configContent, "utf8");

    console.log("✅ Auth configuration has been reset!");

    if (disabledProviders.length > 0) {
      console.log("\nDisabled the following providers:");
      disabledProviders.forEach((provider) => console.log(`- ${provider}`));
    } else {
      console.log("\nNo providers were enabled, nothing to disable.");
    }

    console.log("\nConfiguration file updated at:", configPath);
  } catch (error) {
    console.error("❌ Failed to reset auth configuration:", error);
    process.exit(1);
  }
}

resetAuthConfig();
