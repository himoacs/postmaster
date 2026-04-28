// Runs before electron-builder packs the app
const fs = require("fs");
const path = require("path");

exports.default = async function (context) {
  console.log("Before pack: Preparing files for packaging...");
  
  // Ensure data directory exists with empty database placeholder
  const dataDir = path.join(context.appOutDir || ".", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Create a .gitkeep to ensure directory is included
  const gitkeep = path.join(dataDir, ".gitkeep");
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, "");
  }
  
  console.log("Before pack: Complete");
};
