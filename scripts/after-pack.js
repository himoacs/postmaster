// Runs after electron-builder packs the app
const fs = require("fs");
const path = require("path");

exports.default = async function (context) {
  console.log("After pack: Finalizing package...");
  
  const { appOutDir, packager } = context;
  
  // Log the output directory for debugging
  console.log("App output directory:", appOutDir);
  console.log("Platform:", packager.platform.name);
  
  // Verify native modules are present
  const serverPath = packager.platform.name === "mac" 
    ? path.join(appOutDir, "PostMaster.app", "Contents", "Resources", "server")
    : path.join(appOutDir, "resources", "server");
  
  if (fs.existsSync(serverPath)) {
    console.log("Checking for native modules in server bundle...");
    
    // Check for better-sqlite3.node
    const betterSqlitePath = path.join(serverPath, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
    if (fs.existsSync(betterSqlitePath)) {
      const stats = fs.statSync(betterSqlitePath);
      console.log("✓ Found better-sqlite3.node (" + (stats.size / 1024).toFixed(2) + " KB)");
    } else {
      console.warn("⚠ WARNING: better-sqlite3.node not found at expected location!");
      console.warn("  Expected:", betterSqlitePath);
      
      // Try to find it elsewhere
      const findCommand = require("child_process").execSync(
        `find "${serverPath}" -name "better_sqlite3.node" 2>/dev/null || true`
      ).toString().trim();
      
      if (findCommand) {
        console.log("  Found at:", findCommand);
      } else {
        console.error("  ERROR: Native module not found anywhere in server bundle!");
      }
    }
  }
  
  // Copy any additional files needed
  // For example, copy LICENSE and README
  const projectRoot = packager.projectDir;
  
  const filesToCopy = ["LICENSE", "README.md"];
  
  for (const file of filesToCopy) {
    const src = path.join(projectRoot, file);
    if (fs.existsSync(src)) {
      const dest = path.join(appOutDir, file);
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file} to package`);
    }
  }
  
  console.log("After pack: Complete");
};
