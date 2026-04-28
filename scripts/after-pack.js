// Runs after electron-builder packs the app
const fs = require("fs");
const path = require("path");

exports.default = async function (context) {
  console.log("After pack: Finalizing package...");
  
  const { appOutDir, packager } = context;
  
  // Log the output directory for debugging
  console.log("App output directory:", appOutDir);
  console.log("Platform:", packager.platform.name);
  
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
