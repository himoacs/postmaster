# Build Resources

This directory contains assets used by electron-builder during the build process.

## Required Files

For production builds, you need to add:

### macOS
- `icon.icns` - App icon for macOS (1024x1024 pixels, ICNS format)

### Windows
- `icon.ico` - App icon for Windows (256x256 pixels, ICO format)

### Linux
- `icons/` directory with PNG icons at various sizes:
  - `16x16.png`
  - `32x32.png`
  - `48x48.png`
  - `64x64.png`
  - `128x128.png`
  - `256x256.png`
  - `512x512.png`

## Generating Icons

You can use tools like:
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [png2icons](https://www.npmjs.com/package/png2icons)
- Online converters

Example using electron-icon-builder:
```bash
npx electron-icon-builder --input=./icon.png --output=./build
```
