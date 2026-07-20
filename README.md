# n8n-nodes-edit-image-pro

[![npm version](https://img.shields.io/npm/v/n8n-nodes-edit-image-pro.svg)](https://www.npmjs.com/package/n8n-nodes-edit-image-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![n8n community node](https://img.shields.io/badge/n8n-community--node-orange)](https://docs.n8n.io/integrations/community-nodes/)

Advanced image editing for [n8n](https://n8n.io) — powered by **[Sharp](https://sharp.pixelplumbing.com/)** (libvips).  
Compatible with **n8n v2.30+**.

---

## ✨ Features

### Original operations (rewritten with Sharp)
| Operation | Description |
|---|---|
| **Blur** | Gaussian blur with configurable sigma |
| **Border** | Add solid-colour padding/border |
| **Composite** | Overlay an image with 24 blend modes |
| **Create** | Generate a blank canvas |
| **Crop** | Extract a region by position and size |
| **Draw** | Rectangle, circle or line with fill + stroke |
| **Rotate** | Rotate by any angle with background fill |
| **Resize** | 5 fit modes: cover, contain, fill, inside, outside |
| **Shear** | Shear along X/Y via affine transform |
| **Text** | Styled text with word-wrap, shadow, alignment |
| **Transparent** | Replace a colour with alpha transparency |
| **Get Information** | Return image metadata (size, format, DPI…) |
| **Multi Step** | Chain any operations in a single node |

### New operations in v0.2.0
| Operation | Description |
|---|---|
| 🖼️ **Template** | 15 preset canvases (Instagram, YouTube, LinkedIn…) with title/subtitle/accent |
| 🔄 **Flip** | Vertical mirror (top ↔ bottom) |
| 🔄 **Flop** | Horizontal mirror (left ↔ right) |
| 🎨 **Grayscale** | Convert to black & white |
| 🎨 **Sepia** | Warm vintage tone |
| 🎨 **Tint** | Apply a colour hue overlay |
| ✨ **Sharpen** | Unsharp mask with fine controls |
| ✨ **Normalize** | Stretch contrast to full dynamic range |
| ✨ **Gamma** | Gamma correction (1.0–3.0) |
| 💧 **Watermark** | Opacity-controlled overlay with gravity positioning |

### Template presets
Instagram Post · Instagram Story · Instagram Portrait · Twitter/X Post · YouTube Thumbnail · Facebook Post · LinkedIn Banner · LinkedIn Post · Pinterest Pin · Open Graph · Email Header · Presentation Slide · Business Card · A4 Document · **Custom**

---

## 📦 Installation

### Via n8n Community Nodes (recommended)

1. Open your n8n instance
2. Go to **Settings → Community Nodes**
3. Click **Install**
4. Enter: `n8n-nodes-edit-image-pro`
5. Click **Install**

### Via npm (self-hosted / Docker)

```bash
npm install n8n-nodes-edit-image-pro
```

Set the `N8N_CUSTOM_EXTENSIONS` environment variable to include the package, or place it in your n8n user data directory under `custom/`.

---

## 🚀 Quick Start Examples

### Create a YouTube Thumbnail
1. Add **Edit Image+** node
2. Set **Operation** → `Template`
3. Choose **Template** → `YouTube Thumbnail (1280×720)`
4. Set **Title** → `My Awesome Video`
5. Set **Subtitle** → `New episode every week`
6. Pick **Background Color**, **Accent Color**

### Add a watermark to all images
1. Add **Edit Image+** node after your image source
2. Set **Operation** → `Watermark`
3. Set **Watermark Image Property** → property name containing your logo
4. Set **Opacity** → `40`
5. Set **Gravity** → `Bottom Right`

### Multi-step: resize → sharpen → add text
1. Add **Edit Image+** node
2. Set **Operation** → `Multi Step`
3. Add step: `Resize` → 1080×1080, fit `Cover`
4. Add step: `Sharpen` → sigma 1.5
5. Add step: `Text` → your caption

---

## ⚙️ Output Options

All operations support these output options:

| Option | Description |
|---|---|
| **Format** | `png` / `jpeg` / `webp` / `avif` / `tiff` / `gif` |
| **Quality** | 1–100 for jpeg/webp/avif |
| **PNG Compression** | 0 (fastest) – 9 (smallest) |
| **Output Property Name** | Save to a different binary property |
| **File Name** | Override the output filename |

---

## 🔧 Requirements

- **n8n** v2.30.0 or later
- **Node.js** v18 or later
- No extra system dependencies — Sharp ships pre-built native binaries for Windows, Linux and macOS

---

## 📋 Changelog

### v0.2.0
- Full rewrite using Sharp (libvips) — no GraphicsMagick required
- Fixed n8n v2 API compatibility (`NodeConnectionType`, `execute()` return)
- Added 10 new operations: Template, Flip, Flop, Grayscale, Sepia, Tint, Sharpen, Normalize, Gamma, Watermark
- Improved Text: font-weight, italic, alignment, drop shadow, line-height
- Improved Draw: stroke colour + width, correct ellipse
- Improved Resize: 5 smart fit modes
- Added AVIF output format
- Added per-operation output property name

### v0.1.10
- Original release — GraphicsMagick based

---

## 🤝 Contributing

Pull requests are welcome!

```bash
git clone https://github.com/unilogica/n8n-edit-image-plus.git
cd n8n-edit-image-plus
npm install --legacy-peer-deps
npm run dev   # watch mode
```

---

## 📄 License

[MIT](LICENSE.md)
