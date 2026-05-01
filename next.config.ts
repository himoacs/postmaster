import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Electron packaging
  output: "standalone",
  
  // Disable Next.js dev indicator in production builds
  devIndicators: false,
  
  // Bundle dependencies instead of treating as external
  bundlePagesRouterDependencies: true,
  
  // Transpile Prisma to bundle it
  transpilePackages: ["@prisma/client"],
  
  // Only keep better-sqlite3 as external (native module)
  serverExternalPackages: ["better-sqlite3"],
  
  // Explicitly include native binaries and Next.js runtime files in output tracing
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/**/better-sqlite3/**/*.node",
      "./node_modules/**/better-sqlite3/build/**/*",
      // Include all Next.js server runtime files
      "./node_modules/next/dist/compiled/next-server/*.js",
    ],
  },
  
  // Exclude build artifacts from output tracing
  outputFileTracingExcludes: {
    "/**": [
      "./dist/**",
      "./coverage/**",
      "./.git/**",
      "./electron-deps/**",
      "./*.log",
      "./*.md",
      "./docs/**",
      "./test/**",
      "./e2e/**",
      "./scripts/**",
      "./build/**",
    ],
  },
};

export default nextConfig;
