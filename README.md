# PostMaster

AI-Powered Multi-Model Writing Assistant built with Next.js and Electron.

## Overview

PostMaster helps you write better content by generating outputs from multiple AI models (GPT-4, Claude, Mistral, etc.), comparing them side-by-side, and synthesizing the best parts into your final piece.

**Key Features:**
- 🤖 Multi-model generation (OpenAI, Anthropic, Mistral, Grok, LiteLLM)
- 🔍 Side-by-side output comparison
- ✨ AI-powered synthesis of best outputs
- 📚 Knowledge base for contextual generation
- 🔒 Local encryption of API keys
- 🎨 Light/dark theme support
- 📦 Desktop app (macOS, Windows, Linux)

---

## For Users

### Download

Visit [https://himoacs.github.io/postmaster/](https://himoacs.github.io/postmaster/) or the [Releases](https://github.com/himoacs/postmaster/releases) page to download the latest version for your platform.

### Quick Start

1. Launch PostMaster
2. Add your API keys (Settings → API Keys)
3. Write a prompt on the Dashboard
4. Select 2-5 models to generate content
5. Compare outputs and synthesize the best version

---

## For Developers

### Quick Start

```bash
# Clone the repository
git clone https://github.com/himoacs/postmaster.git
cd postmaster

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3456](http://localhost:3456) with your browser.

### Running Electron App

```bash
# Option 1: Run Next.js and Electron separately
# Terminal 1:
pnpm dev

# Terminal 2:
pnpm electron:start

# Option 2: Run both concurrently
pnpm electron:dev
```

### Testing

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Pre-release validation (comprehensive checks)
pnpm pre-release
```

### Building

```bash
# Build for your platform
pnpm electron:build:mac     # macOS (ARM64 + Intel)
pnpm electron:build:win     # Windows (x64)
pnpm electron:build:linux   # Linux (AppImage + deb)
```

Packaged apps will be in the `dist/` directory.

---

## Documentation

### Developer Guides

- **[BUILDING.md](BUILDING.md)** - Complete build setup, environment requirements, troubleshooting
- **[RELEASING.md](RELEASING.md)** - Release process, testing requirements, landing page deployment
- **[BUILD_CHECKLIST.md](BUILD_CHECKLIST.md)** - Quick reference for local builds
- **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** - Quick reference for releases

### Testing

- **[test/README.md](test/README.md)** - Test infrastructure, coverage, templates
- **[TEST_IMPLEMENTATION_SUMMARY.md](TEST_IMPLEMENTATION_SUMMARY.md)** - Test architecture overview

### Additional Resources

- **[RELEASE_NOTES_*.md](.)** - Release notes for each version
- **[docs/THEME_COMPATIBILITY_CHECKLIST.md](docs/THEME_COMPATIBILITY_CHECKLIST.md)** - Theme development guide

---

## Tech Stack

- **Framework**: Next.js 16.2.4 (App Router, Standalone mode)
- **Desktop**: Electron 36.3.2
- **Database**: SQLite via Prisma + better-sqlite3
- **UI**: React 19, Tailwind CSS, Radix UI
- **Testing**: Vitest, Playwright, Testing Library
- **Build**: electron-builder, pnpm

---

## Project Structure

```
postmaster/
├── src/
│   ├── app/              # Next.js app router
│   │   ├── (dashboard)/  # Dashboard pages
│   │   ├── (marketing)/  # Marketing pages
│   │   └── api/          # API routes
│   ├── components/       # React components
│   ├── lib/              # Shared utilities
│   └── types/            # TypeScript types
├── electron/             # Electron main process
├── prisma/               # Database schema & migrations
├── test/                 # Test utilities & fixtures
├── e2e/                  # E2E tests (Playwright)
├── docs/                 # Landing page (GitHub Pages) - auto-updated on release
├── scripts/              # Build & release scripts
└── .github/workflows/    # CI/CD pipelines
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## Version Requirements

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 20.x | Required for ABI compatibility |
| pnpm | 9.x or 10.x | Package manager |
| Electron | 36.3.2 | Desktop runtime |
| better-sqlite3 | 12.9.0 | Native database module |

See [BUILDING.md](BUILDING.md) for complete version compatibility matrix.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Links

- **Website**: [https://himoacs.github.io/postmaster/](https://himoacs.github.io/postmaster/)
- **Repository**: [https://github.com/himoacs/postmaster](https://github.com/himoacs/postmaster)
- **Issues**: [https://github.com/himoacs/postmaster/issues](https://github.com/himoacs/postmaster/issues)
- **Releases**: [https://github.com/himoacs/postmaster/releases](https://github.com/himoacs/postmaster/releases)
