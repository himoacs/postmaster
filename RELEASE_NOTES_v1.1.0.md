# PostMaster v1.1.0 - Enhanced Features Release

AI-Powered Multi-Model Writing Assistant

## 🎉 What's New

### New Features
- **Draft Autosave**: Automatic saving of work-in-progress content
- **Workflow Progress Tracking**: Visual indicators for AI generation progress
- **API Key Status Monitoring**: Real-time validation and status display for API keys
- **Source Map Support**: Track source URLs for generated content

### Improvements
- **Enhanced Analytics**: Performance metrics dashboard improvements
- **Better Error Handling**: Improved feedback for API and generation errors
- **Build Optimization**: Fixed Prisma client integration in standalone builds

## 📦 Downloads

### Apple Silicon (M1/M2/M3)
- **DMG**: `PostMaster-1.1.0-arm64.dmg` (399 MB)
  - SHA256: `1b6cf96806c707b156c9201f644952ca8265f94630a8e426245756ac942330c3`
- **ZIP**: `PostMaster-1.1.0-arm64-mac.zip` (385 MB)
  - SHA256: `9b1b3eda28125feda614ad6d4a9e3e4aa31077e38633a1764ccd5d6337773f2e`

### Intel (x64)
- **DMG**: `PostMaster-1.1.0.dmg` (406 MB)
  - SHA256: `abc0968df7bd312c25b3f7150971e7c01ee405cf5778867ff8f624ffeaaf1eb1`
- **ZIP**: `PostMaster-1.1.0-mac.zip` (184 MB)
  - SHA256: `fb159c2828dc2c2806cde0d9a795705b28fc30e9c26d55cc03449fbc7f3348c7`

## ⚠️ Important Installation Notes

**This release is code-signed but NOT notarized by Apple.** To install:

### Option 1: Right-Click Method (Recommended)
1. Download the DMG or ZIP file
2. Mount the DMG (if using DMG) or extract the ZIP
3. **Right-click** on `PostMaster.app` and select "Open"
4. Click "Open" in the security dialog

### Option 2: Command Line
```bash
# Remove quarantine attribute
xattr -cr /Applications/PostMaster.app
```

## 🚀 Core Features

- **Multi-Model AI Integration**: OpenAI, Anthropic, xAI, Mistral, and custom models via LiteLLM
- **Advanced Synthesis Strategies**: Debate, iteration, and comparison workflows
- **Knowledge Base**: Upload URLs, text, or files to inform AI generation
- **Analytics Dashboard**: Track performance metrics and model usage
- **Style Profiles**: Manage and apply consistent writing styles
- **Desktop Auto-Updates**: Stay up-to-date with the latest features

## 🔧 Technical Details

- **Version**: 1.1.0
- **Electron**: v36.3.2
- **Code Signing**: Developer ID Application: Himanshu Gupta (ZF53RFQ7H4)
- **Architectures**: ARM64 (Apple Silicon) and x64 (Intel)
- **Hardened Runtime**: Enabled

## 📝 Full Changelog

See commit history: https://github.com/himoacs/postmaster/compare/v1.0.0...v1.1.0

---

For support or feedback, please open an issue on GitHub.
