// Quick script to check LiteLLM models for deprecated ones
import fetch from 'node:fetch';

const DEPRECATED_PATTERNS = [
  'claude-3-7', // Should be 3.5
  'gpt-4-32k', // No longer available
  'text-davinci', // Old OpenAI models
  'code-davinci',
];

async function checkModels() {
  try {
    const response = await fetch('http://localhost:3456/api/litellm/models');
    const data = await response.json();
    
    if (!data.enabled) {
      console.log('❌ LiteLLM not enabled');
      return;
    }
    
    console.log(`\n✅ Found ${data.models.length} LiteLLM models\n`);
    
    const deprecated = [];
    const suspect = [];
    
    for (const model of data.models) {
      const modelId = model.id.toLowerCase();
      
      // Check for known deprecated patterns
      const isDeprecated = DEPRECATED_PATTERNS.some(pattern => 
        modelId.includes(pattern.toLowerCase())
      );
      
      if (isDeprecated) {
        deprecated.push(model);
      }
      // Flag suspicious versions
      else if (modelId.match(/claude-3\.[7-9]|gpt-[5-9]/)) {
        suspect.push(model);
      }
    }
    
    if (deprecated.length > 0) {
      console.log('⚠️  DEPRECATED MODELS (remove these):\n');
      deprecated.forEach(m => {
        console.log(`   ❌ ${m.id} (${m.name})`);
      });
      console.log('');
    }
    
    if (suspect.length > 0) {
      console.log('⚠️  SUSPICIOUS MODEL VERSIONS (verify these):\n');
      suspect.forEach(m => {
        console.log(`   ⚠️  ${m.id} (${m.name})`);
      });
      console.log('');
    }
    
    if (deprecated.length === 0 && suspect.length === 0) {
      console.log('✅ All models look good!\n');
    } else {
      console.log('💡 Tip: Update your LiteLLM config to use current model versions:');
      console.log('   - Claude 3.5 Sonnet (not 3.7)');
      console.log('   - GPT-4o, GPT-4 Turbo (not GPT-5)');
      console.log('   - Check AWS Bedrock docs for current model IDs\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the dev server is running: pnpm dev\n');
  }
}

checkModels();
