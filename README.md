# GLSL Gradient Fitter

A browser tool for extracting color gradients from images and fitting them into GLSL shader functions — ready to paste into your fragment shader.

**Live demo:** https://bhoffmann93.github.io/gradient-fitter/

---

## What it does

Upload an image, draw a sample line or extract a palette, and the tool fits the colors to a mathematical function. The output is a `palette(float t)` GLSL function you can drop directly into a shader.

Two modes:

**Line Sample** — drag a line across the image to sample colors along it. Fits either a polynomial (least-squares, configurable degree) or a cosine palette ([Inigo Quilez's formula](https://iquilezles.org/articles/palettes/)).

**Palette Extract** — extracts dominant colors from the whole image, then fits them using one of five methods:
- **Catmull-Rom** — smooth spline that passes exactly through each color
- **Linear** — straight segments between stops; dominance weighting available
- **Steps** — hard cuts, area-proportional
- **Polynomial** — least-squares, can overshoot
- **Cosine** — smooth, loops perfectly

Both modes support **linear light interpolation** for Linear and Catmull modes — avoids the dark muddy midpoints you get when interpolating in sRGB space. The GLSL output includes the sRGB conversion. See: [What every coder should know about gamma](https://blog.johnnovak.net/2016/09/21/what-every-coder-should-know-about-gamma/).

---

## About

This project was built as a **vibe coding experiment** to test [Claude Code](https://claude.ai/code)'s capabilities — specifically how well it handles a non-trivial frontend codebase end-to-end: architecture decisions, math implementation, canvas rendering, and iterative UI refinement, all from natural language prompts.

The entire codebase was written through Claude Code sessions with no manual code editing.

---

## Stack

- React 19 + Vite
- Tailwind CSS
- All math (polynomial solver, Catmull-Rom, cosine fitting, k-means, Gaussian elimination) implemented from scratch in vanilla JS

---

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` automatically deploy to GitHub Pages via GitHub Actions. To enable in your fork: go to **Settings → Pages → Source → GitHub Actions**.
