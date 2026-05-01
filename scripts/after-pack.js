// Runs after electron-builder packs the app
const fs = require("fs");
const path = require("path");

// Minimum size for Electron-compiled native module (~1.9MB)
// Node.js-compiled version is ~1.3MB - this catches wrong ABI builds
const MIN_NATIVE_MODULE_SIZE = 1500000; // 1.5MB

exports.default = async function (context) {
  console.log("After pack: Finalizing package...");
  
  const { appOutDir, packager } = context;
  
  // Log the output directory for debugging
  console.log("App output directory:", appOutDir);
  console.log("Platform:", packager.platform.name);
  
  // Verify native modules are present and correct size
  const serverPath = packager.platform.name === "mac" 
    ? path.join(appOutDir, "PostMaster.app", "Contents", "Resources", "server")
    : path.join(appOutDir, "resources", "server");
  
  if (fs.existsSync(serverPath)) {
    console.log("Checking for native modules in server bundle...");
    
    // Check for better-sqlite3.node in main location
    const betterSqlitePath = path.join(serverPath, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
    let foundMainModule = false;
    let mainModuleSize = 0;
    
    if (fs.existsSync(betterSqlitePath)) {
      const stats = fs.statSync(betterSqlitePath);
      mainModuleSize = stats.size;
      foundMainModule = true;
      console.log("✓ Found better-sqlite3.node in node_modules/ (" + (stats.size / 1024).toFixed(2) + " KB)");
      
      // Validate size - Electron builds are ~1.9MB, Node.js builds are ~1.3MB
      if (stats.size < MIN_NATIVE_MODULE_SIZE) {
        console.error("✗ ERROR: Native module is too small!");
        console.error("  Size: " + (stats.size / 1024 / 1024).toFixed(2) + " MB");
        console.error("  Expected: >" + (MIN_NATIVE_MODULE_SIZE / 1024 / 1024).toFixed(2) + " MB for Electron build");
        console.error("  This suggests the module was built for Node.js, not Electron.");
        console.error("  The app will crash with NODE_MODULE_VERSION mismatch!");
        throw new Error("Native module ABI mismatch detected - module too small for Electron build");
      }
    } else {
      console.warn("⚠ WARNING: better-sqlite3.node not found at expected location!");
      console.warn("  Expected:", betterSqlitePath);
    }
    
    // Also check for better-sqlite3.node in traced location (.next/node_modules/better-sqlite3-HASH/)
    const nextNodeModules = path.join(serverPath, ".next", "node_modules");
    if (fs.existsSync(nextNodeModules)) {
      const tracedDirs = fs.readdirSync(nextNodeModules).filter(d => d.startsWith("better-sqlite3-"));
      
      for (const dir of tracedDirs) {
        const tracedPath = path.join(nextNodeModules, dir, "build", "Release", "better_sqlite3.node");
        if (fs.existsSync(tracedPath)) {
          const stats = fs.statSync(tracedPath);
          console.log("✓ Found better-sqlite3.node in traced location (" + (stats.size / 1024).toFixed(2) + " KB)");
          console.log("  Path: .next/node_modules/" + dir + "/build/Release/");
          
          // Validate size
          if (stats.size < MIN_NATIVE_MODULE_SIZE) {
            console.error("✗ ERROR: Traced native module is too small!");
            console.error("  Size: " + (stats.size / 1024 / 1024).toFixed(2) + " MB");
            console.error("  This is the module Next.js will actually load at runtime!");
            throw new Error("Native module ABI mismatch detected in traced directory");
          }
          
          // Verify it matches main module if both exist
          if (foundMainModule && stats.size !== mainModuleSize) {
            console.warn("⚠ WARNING: Traced module size differs from main module!");
            console.warn("  Main: " + mainModuleSize + " bytes");
            console.warn("  Traced: " + stats.size + " bytes");
          }
        }
      }
    }
    
    // If no module found anywhere, that's an error
    if (!foundMainModule) {
      // Try to find it elsewhere
      const findCommand = require("child_process").execSync(
        `find "${serverPath}" -name "better_sqlite3.node" 2>/dev/null || true`
      ).toString().trim();
      
      if (findCommand) {
        console.log("  Found at:", findCommand);
        // Verify size of found module
        const stats = fs.statSync(findCommand.split("\n")[0]);
        if (stats.size < MIN_NATIVE_MODULE_SIZE) {
          throw new Error("Native module found but too small - wrong ABI");
        }
      } else {
        console.error("  ERROR: Native module not found anywhere in server bundle!");
        throw new Error("Native module not found in package");
      }
    }
  }
  
  // Copy any additional files needed
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
