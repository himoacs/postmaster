#!/bin/bash

# Fix synthesize.test.ts - add imageUrl and imagePrompt to all SynthesizedContent mocks
sed -i '' '/reasoning: string,$/a\
      imageUrl: null,\
      imagePrompt: null,
' src/app/api/__tests__/synthesize.test.ts

sed -i '' '/reasoning: null,$/a\
      imageUrl: null,\
      imagePrompt: null,
' src/app/api/__tests__/synthesize.test.ts

# Remove obsolete "closings" field from generate.test.ts
sed -i '' '/closings:/d' src/app/api/__tests__/generate.test.ts

echo "Fixed all issues!"
