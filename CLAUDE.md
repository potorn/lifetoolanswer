# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Static website ("생활도구") monetized via Google AdSense and deployed on Cloudflare Pages. No build step, no framework, no package manager — plain HTML + CSS + JS only.

## Running locally

```bash
python -m http.server 8080 --directory D:\ai_dev\site
# Open http://localhost:8080
```

There are no tests, no linting, and no CI. Verify changes by loading the affected page in a browser.

## Architecture

```
index.html          ← Home page (tool card grid, category sections)
css/style.css       ← Global layout: header, hero, tool card grid, footer, ad-slot class
css/tool.css        ← Tool page layout: breadcrumb, .card, form inputs, result card, BMI gauge, loan schedule table
js/<tool>.js        ← One JS file per tool; no shared JS
tools/<tool>.html   ← One HTML file per tool
sitemap.xml / robots.txt
```

Both CSS files are loaded on every tool page (`style.css` first, then `tool.css`). CSS custom properties (`--primary`, `--border`, etc.) are defined in `style.css` and used in both files.

## Adding a new tool

1. Create `tools/<name>.html` — copy the breadcrumb/header/card/ad-slot/footer pattern from an existing tool page.
2. Create `js/<name>.js` — attach logic via `DOMContentLoaded`.
3. Add a `.tool-card` anchor to `index.html` under the appropriate category section.
4. Add the URL to `sitemap.xml`.
5. Add any tool-specific CSS to the bottom of `css/tool.css` with a section comment.

## AdSense placeholders

Every page has AdSense script tags and ad slots commented out. When AdSense is approved:
- Uncomment the `<script async src="https://pagead2.googlesyndication.com/...">` tag in each `<head>`.
- Replace `<div class="ad-slot">` placeholders with `<ins class="adsbygoogle">` tags.
- The `.ad-slot` CSS class in `style.css` is only for the dev placeholder and can be removed.

## Deployment

Upload the entire `D:\ai_dev\site\` directory to Cloudflare Pages ("Upload assets"). After deploying, replace `your-domain.pages.dev` in `sitemap.xml` and `robots.txt` with the actual domain.

## BMI logic (js/bmi.js)

Uses 대한비만학회 (Korean Society for the Study of Obesity) cutoffs: <18.5 저체중, 18.5–23 정상, 23–25 과체중, 25–30 비만1단계, ≥30 비만2단계. These differ from WHO standards — do not change them to WHO values.

## Loan calculator logic (js/loan.js)

Supports three repayment methods: 원리금균등 (equal total payment), 원금균등 (equal principal), 만기일시 (bullet). Input unit is 만원 (×10,000 won). The schedule table renders first 6 rows + last row when total months > 12.
