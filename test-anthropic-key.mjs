#!/usr/bin/env node
/**
 * Anthropic API Key Diagnostic Tool
 * Tests your key directly with detailed error reporting
 */

import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY || process.argv[2];

if (!apiKey) {
  console.error("❌ No API key provided");
  console.log("\nUsage:");
  console.log("  node test-anthropic-key.mjs YOUR_API_KEY");
  console.log("  OR");
  console.log("  ANTHROPIC_API_KEY=your_key node test-anthropic-key.mjs");
  process.exit(1);
}

console.log("🔍 Testing Anthropic API Key...\n");

// Check key format
console.log("1. Key Format Check:");
if (!apiKey.startsWith("sk-ant-")) {
  console.log("   ⚠️  Warning: Key doesn't start with 'sk-ant-'");
  console.log("   Expected format: sk-ant-api03-...");
} else {
  console.log("   ✅ Format looks correct (starts with sk-ant-)");
}

console.log(`   Length: ${apiKey.length} characters`);
console.log(`   Preview: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}\n`);

// Test API call
console.log("2. API Connection Test:");
try {
  const client = new Anthropic({ apiKey });
  
  console.log("   Attempting minimal API call...");
  const message = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 10,
    messages: [{ role: "user", content: "Hi" }],
  });

  console.log("   ✅ SUCCESS! Key is valid\n");
  console.log("   Response:");
  console.log(`   - Model: ${message.model}`);
  console.log(`   - Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
  console.log(`   - Content: ${message.content[0]?.text || "(no text)"}\n`);
  
  console.log("3. Available Models:");
  console.log("   ✅ claude-sonnet-4-20250514 (Claude Sonnet 4)");
  console.log("   ✅ claude-3-5-sonnet-20241022 (Claude 3.5 Sonnet)");
  console.log("   ✅ claude-3-opus-20240229 (Claude 3 Opus)");
  console.log("   ✅ claude-3-haiku-20240307 (Claude 3 Haiku)");
  
  console.log("\n✨ Your key is working correctly!");
  console.log("   If it still fails in PostMaster, try:");
  console.log("   1. Delete and re-add the key in Settings");
  console.log("   2. Check browser DevTools Console for errors");
  console.log("   3. Restart the app\n");
  
} catch (error) {
  console.log("   ❌ FAILED\n");
  
  // Anthropic SDK error structure: error.error.error.type and error.error.error.message
  const errorType = error?.error?.error?.type || error?.type;
  const errorMessage = error?.error?.error?.message || error?.message;
  
  // Check for billing/credit errors first (most common)
  if (errorType === "invalid_request_error" && 
      (errorMessage?.includes("credit balance") || 
       errorMessage?.includes("billing"))) {
    console.log("Error Type: INSUFFICIENT_CREDITS");
    console.log("Reason: No billing method or credits exhausted\n");
    console.log("API Message:");
    console.log(`  "${errorMessage}"\n`);
    console.log("Solution:");
    console.log("  1. Go to https://console.anthropic.com/settings/billing");
    console.log("  2. Add a payment method OR purchase credits");
    console.log("  3. Wait a few minutes for activation");
    console.log("  4. Try again");
    console.log("\n✅ PostMaster Update: The app will now show:");
    console.log('   "Insufficient credits. Please add billing at console.anthropic.com/settings/billing"');
    console.log('   Instead of the generic "Invalid API key" message\n');
    
  } else if (error.status === 401 || errorType === "authentication_error") {
    console.log("Error Type: AUTHENTICATION_ERROR");
    console.log("Reason: Invalid API key\n");
    console.log("Common causes:");
    console.log("  • Key was copied incorrectly (missing characters, extra spaces)");
    console.log("  • Key has been revoked or deleted");
    console.log("  • Using a test/development key on production API");
    console.log("\nSolution:");
    console.log("  1. Go to https://console.anthropic.com/settings/keys");
    console.log("  2. Create a new API key");
    console.log("  3. Copy it carefully (no spaces or line breaks)");
    console.log("  4. Try again\n");
    
  } else if (error.status === 429) {
    console.log("Error Type: RATE_LIMIT_ERROR");
    console.log("Reason: Too many requests\n");
    console.log("Solution:");
    console.log("  • Wait a few minutes and try again");
    console.log("  • Check your account limits at https://console.anthropic.com/settings/limits\n");
    
  } else if (error.status === 403) {
    console.log("Error Type: PERMISSION_ERROR");
    console.log("Reason: Account or billing issue\n");
    console.log("Common causes:");
    console.log("  • No billing method on file");
    console.log("  • Account suspended or credits exhausted");
    console.log("  • Organization settings block API access");
    console.log("\nSolution:");
    console.log("  1. Check https://console.anthropic.com/settings/billing");
    console.log("  2. Add payment method if needed");
    console.log("  3. Check account status");
    console.log("\nNote: PostMaster will now show this specific error instead of 'Invalid API key'\n");
    
  } else if (error.status === 500 || error.status === 529) {
    console.log("Error Type: SERVER_ERROR");
    console.log("Reason: Anthropic API is having issues\n");
    console.log("Solution:");
    console.log("  • Check https://status.anthropic.com/");
    console.log("  • Wait and try again later\n");
    
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    console.log("Error Type: NETWORK_ERROR");
    console.log("Reason: Cannot reach Anthropic servers\n");
    console.log("Solution:");
    console.log("  • Check your internet connection");
    console.log("  • Check if you're behind a firewall/proxy");
    console.log("  • Try again in a few moments\n");
    
  } else {
    console.log("Error Type: UNKNOWN_ERROR");
    console.log(`Status: ${error.status || 'N/A'}`);
    console.log(`Code: ${error.code || 'N/A'}\n`);
  }
  
  console.log("Full Error Details:");
  console.log(error.message);
  
  if (error.error) {
    console.log("\nAPI Response:");
    console.log(JSON.stringify(error.error, null, 2));
  }
  
  process.exit(1);
}
