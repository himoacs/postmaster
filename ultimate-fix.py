#!/usr/bin/env python3
import re

# Complete StyleProfile schema  
STYLE_PROFILE_TEMPLATE = """{{
        id: '{id}',
        tone: {tone},
        voice: {voice},
        vocabulary: {vocabulary},
        sentence: {sentence},
        patterns: {patterns},
        uniqueVocabulary: {uniqueVocabulary},
        avoidPatterns: {avoidPatterns},
        writingQuirks: {writingQuirks},
        sampleExcerpts: {sampleExcerpts},
        openingStyles: {openingStyles},
        closingStyles: {closingStyles},
        bio: {bio},
        context: {context},
        overrides: {overrides},
        analyzedAt: {analyzedAt},
        createdAt: new Date(),
        updatedAt: new Date(),
      }}"""

def fix_style_profile_mocks(filepath):
    """Fix all StyleProfile mocks to include all fields"""
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Detect StyleProfile mock
        if 'prisma.styleProfile.findFirst' in line and 'mockResolvedValue({' in line:
            result.append(line)
            i += 1
            
            # Collect existing mock fields
            mock_fields = {}
            while i < len(lines) and '});' not in lines[i]:
                field_line = lines[i].strip()
                if ':' in field_line:
                    field_name = field_line.split(':')[0].strip()
                    field_value = ':'.join(field_line.split(':')[1:]).strip().rstrip(',')
                    if field_name and field_name not in ['createdAt', 'updatedAt']:
                        mock_fields[field_name] = field_value
                i += 1
            
            # Build complete mock
            complete_mock = STYLE_PROFILE_TEMPLATE.format(
                id=mock_fields.get('id', "'style-1'"),
                tone=mock_fields.get('tone', 'null'),
                voice=mock_fields.get('voice', 'null'),
                vocabulary=mock_fields.get('vocabulary', 'null'),
                sentence=mock_fields.get('sentence', 'null'),
                patterns=mock_fields.get('patterns', 'null'),
                uniqueVocabulary=mock_fields.get('uniqueVocabulary', 'null'),
                avoidPatterns=mock_fields.get('avoidPatterns', 'null'),
                writingQuirks=mock_fields.get('writingQuirks', 'null'),
                sampleExcerpts=mock_fields.get('sampleExcerpts', 'null'),
                openingStyles=mock_fields.get('openingStyles', 'null'),
                closingStyles=mock_fields.get('closingStyles', 'null'),
                bio=mock_fields.get('bio', 'null'),
                context=mock_fields.get('context', 'null'),
                overrides=mock_fields.get('overrides', 'null'),
                analyzedAt=mock_fields.get('analyzedAt', 'null')
            )
            
            # Add complete mock
            for mock_line in complete_mock.split('\n'):
                result.append(mock_line + '\n')
            result.append('      });\n')
            i += 1
            continue
        
        result.append(line)
        i += 1
    
    with open(filepath, 'w') as f:
        f.writelines(result)

# Fix generate.test.ts
print("Fixing generate.test.ts StyleProfile mocks...")
fix_style_profile_mocks('src/app/api/__tests__/generate.test.ts')

# Fix synthesize.test.ts - add imageUrl and imagePrompt
print("Fixing synthesize.test.ts SynthesizedContent mocks...")
with open('src/app/api/__tests__/synthesize.test.ts', 'r') as f:
    content = f.read()

# Use regex to add imageUrl and imagePrompt after reasoning field
content = re.sub(
    r'(reasoning: (?:string|null),)\n(\s+)(?!imageUrl)',
    r'\1\n\2imageUrl: null,\n\2imagePrompt: null,\n\2',
    content
)

with open('src/app/api/__tests__/synthesize.test.ts', 'w') as f:
    f.write(content)

# Fix critique.test.ts LiteLLMConfig mock
print("Fixing critique.test.ts LiteLLMConfig mock...")
with open('src/app/api/__tests__/critique.test.ts', 'r') as f:
    lines = f.readlines()

result = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Find the incomplete LiteLLMConfig mock around line 516
    if "isEnabled: true," in line and i > 510 and i < 520:
        # Check if this is the incomplete mock
        if 'endpoint:' not in ''.join(lines[max(0, i-10):i]):
            # This is the incomplete one - need to add missing fields
            result.append(line)  # Add isEnabled: true,
            i += 1
            # Skip isValid and dates, we'll rebuild
            while i < len(lines) and '});' not in lines[i]:
                i += 1
            # Add complete mock
            result.append("        isValid: true,\n")
            result.append("        endpoint: 'http://localhost:4000',\n")
            result.append("        encryptedKey: null,\n")
            result.append("        lastValidated: null,\n")
            result.append("        cachedModels: '[]',\n")
            result.append("        createdAt: new Date(),\n")
            result.append("        updatedAt: new Date(),\n")
            result.append("      });\n")
            i += 1
            continue
    
    result.append(line)
    i += 1

with open('src/app/api/__tests__/critique.test.ts', 'w') as f:
    f.writelines(result)

print("All files fixed!")
