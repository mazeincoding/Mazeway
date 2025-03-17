import fs from "fs";
import path from "path";
import readline from "readline";

// Track warnings and manual steps
interface Warning {
  message: string;
  manualStep: string;
}
const warnings: Warning[] = [];

async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    "\n🔒 This script will put the project back to the default state."
  );

  return new Promise((resolve) => {
    rl.question("\nAre you sure you want to proceed? (y/N) ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

function addWarning(message: string, manualStep: string) {
  warnings.push({ message, manualStep });
  console.warn(`Warning: ${message}`);
}

function deleteIfExists(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmdirSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
      return true;
    }
    return false;
  } catch (error) {
    addWarning(
      `Could not delete ${filePath}: ${error}`,
      `Manually delete ${filePath} using your file explorer or terminal`
    );
    return false;
  }
}

function updateTsConfig(): boolean {
  const tsConfigPath = path.join(process.cwd(), "tsconfig.json");
  try {
    if (fs.existsSync(tsConfigPath)) {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, "utf8"));
      if (tsConfig.include && tsConfig.include.includes("trigger.config.ts")) {
        tsConfig.include = tsConfig.include.filter(
          (item: string) => item !== "trigger.config.ts"
        );
        fs.writeFileSync(
          tsConfigPath,
          JSON.stringify(tsConfig, null, 2) + "\n"
        );
        return true;
      }
    }
    return false;
  } catch (error) {
    addWarning(
      `Could not update tsconfig.json: ${error}`,
      "Manually remove 'trigger.config.ts' from the 'include' array in tsconfig.json"
    );
    return false;
  }
}

function updateGitIgnore(): boolean {
  const gitIgnorePath = path.join(process.cwd(), ".gitignore");
  try {
    if (fs.existsSync(gitIgnorePath)) {
      const content = fs.readFileSync(gitIgnorePath, "utf8");
      const lines = content.split("\n");
      const filteredLines = lines.filter((line) => line.trim() !== ".trigger");
      if (lines.length !== filteredLines.length) {
        fs.writeFileSync(gitIgnorePath, filteredLines.join("\n"));
        return true;
      }
    }
    return false;
  } catch (error) {
    addWarning(
      `Could not update .gitignore: ${error}`,
      "Manually remove the '.trigger' line from your .gitignore file"
    );
    return false;
  }
}

async function resetProject() {
  try {
    const shouldProceed = await confirmReset();

    if (!shouldProceed) {
      console.log("❌ Operation cancelled");
      process.exit(0);
    }

    console.log("\n🔒 Resetting project...");

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

    // Delete trigger-related files and directories
    const deletedItems: string[] = [];
    const itemsToDelete = [
      path.join(process.cwd(), "trigger.config.ts"),
      path.join(process.cwd(), "src", "trigger"),
      path.join(process.cwd(), "src", "utils", "trigger"),
    ];

    for (const item of itemsToDelete) {
      if (deleteIfExists(item)) {
        deletedItems.push(path.relative(process.cwd(), item));
      }
    }

    // Update configuration files
    const configChanges: string[] = [];
    if (updateTsConfig()) {
      configChanges.push("Removed 'trigger.config.ts' from tsconfig.json");
    }
    if (updateGitIgnore()) {
      configChanges.push("Removed '.trigger' from .gitignore");
    }

    console.log("✅ Project has been reset!");

    if (disabledProviders.length > 0) {
      console.log("\nDisabled the following providers:");
      disabledProviders.forEach((provider) => console.log(`- ${provider}`));
    }

    if (deletedItems.length > 0) {
      console.log("\nDeleted the following items:");
      deletedItems.forEach((item) => console.log(`- ${item}`));
    }

    if (configChanges.length > 0) {
      console.log("\nConfiguration changes:");
      configChanges.forEach((change) => console.log(`- ${change}`));
    }

    // Display any warnings and manual steps if there were issues
    if (warnings.length > 0) {
      console.log("\n⚠️ Some operations could not be completed automatically:");
      console.log(
        "\nTo complete the reset, please perform these steps manually:"
      );
      warnings.forEach((warning, index) => {
        console.log(`\n${index + 1}. ${warning.manualStep}`);
      });
    }
  } catch (error) {
    console.error("❌ Failed to reset project:", error);
    process.exit(1);
  }
}

resetProject();
