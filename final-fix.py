#!/usr/bin/env python3
import re

# First, manually fix the files by reading and carefully updating them

# Fix generate.test.ts - remove all duplicates and add missing fields
print("Reading generate.test.ts...")
with open('src/app/api/__tests__/generate.test.ts', 'r') as f:
    lines = f.readlines()

print("Fixing generate.test.ts duplicates and missing fields...")
result = []
skip_next = False
i = 0
while i < len(lines):
    line = lines[i]
    
    # Skip duplicate sourceMap lines (where null is followed by actual value)
    if 'sourceMap: null,' in line and i + 1 < len(lines) and 'sourceMap:' in lines[i + 1]:
        # Skip the null line, keep the actual value line
        i += 1
        continue
    
    # Remove obsolete fields
    if any(field in line for field in ['openings:', 'transitions:', 'vocabulary_', 'formality:', 'idioms:']):
        i += 1
        continue
    
    result.append(line)
    i += 1

with open('src/app/api/__tests__/generate.test.ts', 'w') as f:
    f.writelines(result)

# Fix iterate.test.ts - remove duplicates and add reasoning to SynthesisVersion
print("Reading iterate.test.ts...")
with open('src/app/api/__tests__/iterate.test.ts', 'r') as f:
    lines = f.readlines()

print("Fixing iterate.test.ts duplicates and missing fields...")
result = []
in_synthesis_version_mock = False
synthesis_version_fields_seen = set()
skip_line = False
i = 0

while i < len(lines):
    line = lines[i]
    
    # Track when we're in a synthesisVersion mock
    if 'prisma.synthesisVersion.' in line and 'mockResolvedValue({' in line:
        in_synthesis_version_mock = True
        synthesis_version_fields_seen = set()
        result.append(line)
        i += 1
        continue
    
    # End of synthesisVersion mock
    if in_synthesis_version_mock and line.strip() == '});':
        # Add reasoning if not present
        if 'reasoning' not in synthesis_version_fields_seen:
            # Insert reasoning before closing
            indent = '        '
            result.append(f'{indent}reasoning: null,\n')
        in_synthesis_version_mock = False
        synthesis_version_fields_seen = set()
        result.append(line)
        i += 1
        continue
    
    # Track fields in synthesisVersion mock
    if in_synthesis_version_mock:
        for field in ['version:', 'content:', 'feedback:', 'createdAt:', 'reasoning:', 'synthesizedContentId:', 'id:']:
            if field in line:
                if field in synthesis_version_fields_seen:
                    # Skip duplicate
                    skip_line = True
                    break
                synthesis_version_fields_seen.add(field)
        
        if skip_line:
            skip_line = False
            i += 1
            continue
    
    # Skip duplicate fields in synthesizedContent mocks
    if 'parentSynthesisId:' in line and i > 0:
        # Check if we already saw this field recently (within last 10 lines)
        found_duplicate = False
        for j in range(max(0, len(result) - 10), len(result)):
            if 'parentSynthesisId:' in result[j]:
                found_duplicate = True
                break
        if found_duplicate:
            i += 1
            continue
    
    if 'globalVersion:' in line and i > 0:
        found_duplicate = False
        for j in range(max(0, len(result) - 10), len(result)):
            if 'globalVersion:' in result[j]:
                found_duplicate = True
                break
        if found_duplicate:
            i += 1
            continue
    
    if 'imageUrl:' in line and i > 0:
        found_duplicate = False
        for j in range(max(0, len(result) - 10), len(result)):
            if 'imageUrl:' in result[j]:
                found_duplicate = True
                break
        if found_duplicate:
            i += 1
            continue
    
    if 'imagePrompt:' in line and i > 0:
        found_duplicate = False
        for j in range(max(0, len(result) - 10), len(result)):
            if 'imagePrompt:' in result[j]:
                found_duplicate = True
                break
        if found_duplicate:
            i += 1
            continue
    
    result.append(line)
    i += 1

with open('src/app/api/__tests__/iterate.test.ts', 'w') as f:
    f.writelines(result)

# Fix critique.test.ts - add missing fields to LiteLLMConfig and fix other issues
print("Reading critique.test.ts...")
with open('src/app/api/__tests__/critique.test.ts', 'r') as f:
    content = f.read()

# Remove obsolete fields
content = re.sub(r'^\s+modelPrefixes:.*,\n', '', content, flags=re.MULTILINE)

with open('src/app/api/__tests__/critique.test.ts', 'w') as f:
    f.write(content)

print("All files fixed!")
