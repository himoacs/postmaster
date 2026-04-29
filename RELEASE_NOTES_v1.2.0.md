# PostMaster v1.2.0 Release Notes

**Release Date:** April 29, 2026

## 🎯 What's New

### Enhanced Analytics - Text Similarity-Based Contribution Tracking

This release introduces intelligent contribution tracking that measures **actual usage** of each AI model's output in the final synthesis, replacing simple participation metrics.

#### Key Improvements:

**📊 Meaningful Selection Rate Metrics**
- Analytics now shows **actual contribution percentages** based on content similarity
- Replaces binary "100% for all participants" with granular usage data
- Example: Model A (67%), Model B (33%) instead of both showing 100%

**🧠 Jaccard Similarity Algorithm**
- Paragraph-level content matching (70% weight)
- Document-level similarity analysis (30% weight)
- Fast, synchronous calculation - no API costs

**📈 Better Decision Making**
- Identify which models consistently provide more useful content
- Make informed decisions about model selection
- Optimize synthesis strategy based on real usage patterns

---

## 🔧 Technical Details

### New Components

**Text Similarity Engine** (`src/lib/analysis/text-similarity.ts`)
- `calculateJaccardSimilarity()`: Measures overlap between two text blocks
- `calculateWeightedUsageAttribution()`: Analyzes synthesis to attribute content to source models
- Weighted approach: 70% paragraph-level + 30% document-level matching

**Updated Synthesis Tracking** (`src/app/api/synthesize/stream/route.ts`)
- Integrated text similarity analysis into streaming synthesis endpoint
- Dynamic contribution calculation based on actual content usage
- Stores percentages in `SynthesisContribution.aspectCount` (0-100 range)

### Database Schema

No schema changes required. Uses existing `SynthesisContribution` table:
- `aspectCount`: Now stores percentage (0-100) instead of binary (0 or 1)
- `totalAspects`: Set to 100 for percentage interpretation

---

## 📝 Changes

### Added
- Text similarity analysis module with Jaccard algorithm
- Weighted content attribution for synthesis tracking
- Granular model contribution percentages in Analytics

### Changed
- Selection Rate calculation now based on text similarity instead of participation
- `aspectCount` interpretation changed from binary to percentage (0-100)
- Synthesis tracking now analyzes content overlap per paragraph

### Fixed
- Analytics Selection Rate no longer shows "—" for streaming synthesis
- Models no longer incorrectly show 100% contribution when only partially used

---

## 🚀 Getting Started

### Upgrading from v1.1.0

1. **Download** the new version from [GitHub Releases](https://github.com/himoacs/postmaster/releases/tag/v1.2.0)
2. **Install** over your existing installation
3. **No database migration needed** - existing data remains compatible

### Seeing the New Metrics

1. Generate content with 2-3 models
2. Run synthesis to combine outputs
3. Navigate to **Analytics** page
4. Check the **Selection Rate** column for percentage-based contributions

---

## 📦 Downloads

### macOS
- **Apple Silicon (M1/M2/M3)**: `PostMaster-1.2.0-arm64.dmg`
- **Intel**: `PostMaster-1.2.0.dmg`

### Windows
- `PostMaster Setup 1.2.0.exe`

### Linux
- `PostMaster-1.2.0.AppImage`
- `PostMaster_1.2.0_amd64.deb`

---

## 🙏 Credits

Built with contributions from the community. Special thanks to all testers and feedback providers.

---

## 🐛 Known Issues

- OpenAI quota errors during synthesis will skip that model's contribution
- Very short synthesis outputs (<50 words) may show skewed percentages
- Old synthesis records (pre-v1.2.0) still show binary 0 or 1 values

---

## 📚 Documentation

- [User Guide](https://github.com/himoacs/postmaster#readme)
- [Building from Source](https://github.com/himoacs/postmaster/blob/main/BUILDING.md)
- [Contributing](https://github.com/himoacs/postmaster/blob/main/CONTRIBUTING.md)

---

**Full Changelog**: https://github.com/himoacs/postmaster/compare/v1.1.0...v1.2.0
