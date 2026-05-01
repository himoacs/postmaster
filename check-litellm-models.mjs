// Quick script to list LiteLLM models
import fetch from 'node:fetch';

async function checkModels() {
  try {
    const response = await fetch('http://localhost:3456/api/litellm/models');
    const data = await response.json();
    
    if (!data.enabled) {
      console.log('❌ LiteLLM not enabled');
      return;
    }
    
    console.log(`\n✅ Found ${data.models.length} LiteLLM models\n`);
    
    // Group by provider
    const byProvider = {};
    for (const model of data.models) {
      const provider = model.provider || 'unknown';
      if (!byProvider[provider]) {
        byProvider[provider] = [];
      }
      byProvider[provider].push(model);
    }
    
    // Display grouped by provider
    for (const [provider, models] of Object.entries(byProvider)) {
      console.log(`📦 ${provider.toUpperCase()} (${models.length} models)`);
      models.forEach(m => {
        console.log(`   • ${m.id}`);
      });
      console.log('');
    }
    
    console.log('✅ Model list complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the dev server is running: pnpm dev\n');
  }
}

checkModels();
