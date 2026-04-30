# LiteLLM Token Usage Tracking

## Problem
Token usage data shows as "—" in Model Analytics because LiteLLM proxy isn't returning token counts.

## Root Cause
Not all LiteLLM-proxied providers support token usage reporting in streaming mode. Common issues:

1. **Azure OpenAI**: Requires `stream_options: { include_usage: true }` (✅ already configured)
2. **Bedrock/Claude**: May not return usage in stream
3. **Gemini**: Usage reporting varies by model
4. **Older LiteLLM versions**: May not support usage tracking

## Diagnosis
Check your database:
```bash
sqlite3 data/postmaster.db "SELECT provider, model, tokensUsed, latencyMs FROM GenerationOutput ORDER BY createdAt DESC LIMIT 10;"
```

If `tokensUsed` is always `0` or `NULL`, LiteLLM isn't returning usage data.

## Solutions

### 1. Update LiteLLM
Ensure you're running the latest version:
```bash
pip install --upgrade litellm
```

### 2. Check LiteLLM Logs
Enable debug logging to see if usage data is received from providers:
```bash
export LITELLM_LOG=DEBUG
litellm --config your_config.yaml
```

Look for lines like `"usage": {"total_tokens": ...}` in the response.

### 3. Provider-Specific Fixes

**Azure OpenAI:**
- Make sure your Azure deployment supports streaming with usage
- Some older deployments don't return usage in streams

**Bedrock:**
- Token usage may only be available in non-streaming mode
- Consider using direct Anthropic API keys for better tracking

**Gemini:**
- Flash models often don't return usage in streams
- Pro models are more reliable

### 4. Test Direct Providers
Add direct API keys (OpenAI, Anthropic) to verify token tracking works:
1. Go to Settings → API Keys
2. Add an OpenAI or Anthropic key
3. Generate with those models
4. Check if tokens are tracked

## Current Status in PostMaster
- ✅ App requests `stream_options: { include_usage: true }`
- ✅ Code handles token usage when provided
- ❌ LiteLLM proxy not returning usage data
- ✅ Latency tracking works fine (proves streaming works)

## Workaround
If token tracking is critical, consider:
1. Use non-streaming mode (slower but may return usage)
2. Use direct provider API keys instead of LiteLLM proxy
3. Estimate tokens based on content length (rough approximation)
