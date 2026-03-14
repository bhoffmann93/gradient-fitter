# gradient-fitter

A browser tool for extracting color gradients from images and fitting them into GLSL shader functions — ready to paste into your fragment shader.

**Live demo:** https://www.bernhard-hoffmann.com/gradient-fitter/

---

## What it does

Upload an image, draw a sample line or extract a palette, and the tool fits the colors to a mathematical function. The output is a `palette(float t)` GLSL function you can drop directly into a shader.

Two modes:

**Line Sample** — drag a line across the image to sample colors along it. Fits either a polynomial (least-squares, configurable degree) or a cosine palette ([Inigo Quilez Cosine Palette](https://iquilezles.org/articles/palettes/)).

**Palette Extract** — extracts dominant colors from the whole image, then fits them using one of five methods:

- **Catmull-Rom** — smooth spline that passes exactly through each color
- **Linear** — straight segments between stops

- **Polynomial** — least-squares fitting, can overshoot
- **Cosine** — smooth, option to loop perfectly ([Inigo Quilez Cosine Palette](https://iquilezles.org/articles/palettes/)).

Both modes support **interpolation in Linear RGB** for Linear and Catmull modes — avoids the dark muddy midpoints you get when interpolating in sRGB space. The GLSL output includes the sRGB conversion. 
See: [What every coder should know about gamma](https://blog.johnnovak.net/2016/09/21/what-every-coder-should-know-about-gamma/).

Dominance weighting available for catmull-rom and linear which places the stops in relation to the dominance of colors extracted.

---

## About

This project was built as a **vibe coding experiment** to test [Claude Code](https://claude.ai/code)'s capabilities. The entire codebase was written through Claude Code sessions with no manual code editing.

---

## Stack

- React 19 + Vite
- Tailwind CSS
- [lucide-react](https://lucide.dev/) — icons
- [extract-colors](https://github.com/Namide/extract-colors) — dominant color extraction
- [Colormind API](http://colormind.io/) — AI palette generation (API mode)

---

## Run locally

```bash
npm install
npm run dev
```
