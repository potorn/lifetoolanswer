# 생활도구 / Life Tools

> 광고 없는 무료 온라인 도구 모음  
> A collection of free, ad-supported online utilities

[![Cloudflare Pages](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-F38020?logo=cloudflare)](https://pages.cloudflare.com/)
![HTML](https://img.shields.io/badge/HTML-CSS-JS-plain-blue)

---

## 소개 / About

**생활도구**는 별도 설치 없이 브라우저에서 바로 사용할 수 있는 생활 밀착형 도구 모음 사이트입니다.  
Plain HTML + CSS + JS로 구성된 정적 사이트로, 빌드 도구나 프레임워크 없이 동작합니다.

**Life Tools** is a browser-based utility site — no installation required.  
Built with plain HTML + CSS + JS. No framework, no build step, no dependencies.

---

## 제공 도구 / Tools

| 도구 | 설명 | Tool | Description |
|------|------|------|-------------|
| [BMI 계산기](tools/bmi.html) | 체질량지수 계산 (대한비만학회 기준) | BMI Calculator | Uses Korean Society for the Study of Obesity cutoffs |
| [이미지 변환기](tools/image.html) | PNG · JPG · WebP · GIF · BMP · ICO · AVIF · TGA 변환 | Image Converter | Convert between supported image formats in the browser |
| [GIF 만들기](tools/gif-maker.html) | 사진 여러 장·짧은 동영상으로 GIF 만들기 | GIF Maker | Create GIFs from photos or short videos in the browser |
| [대출 계산기](tools/loan.html) | 원리금균등 / 원금균등 / 만기일시 상환 | Loan Calculator | Equal payment / Equal principal / Bullet repayment |
| [단위 변환기](tools/unit.html) | 길이 · 무게 · 온도 · 넓이 · 부피 | Unit Converter | Length, weight, temperature, area, volume |

---

## 로컬 실행 / Running Locally

```bash
python -m http.server 8080 --directory D:\ai_dev\site
```

브라우저에서 `http://localhost:8080` 접속  
Then open `http://localhost:8080` in your browser.

테스트 도구·빌드 스텝 없음 — 파일을 직접 수정하고 브라우저를 새로고침하면 됩니다.  
No tests, no build — edit a file and refresh the browser.

업로드한 이미지·동영상과 도구 입력값은 브라우저에서 처리되며 생활도구 서버로 전송하거나 저장하지 않습니다. Google Fonts 등 일반 페이지 리소스는 별도로 요청될 수 있습니다.

---

## 프로젝트 구조 / Project Structure

```
site/
├── index.html              # 홈 (도구 카드 그리드)
├── css/
│   ├── style.css           # 전역 레이아웃 (헤더, 푸터, 카드 그리드)
│   └── tool.css            # 도구 페이지 레이아웃 (폼, 결과 카드)
├── js/
│   ├── bmi.js
│   ├── image.js
│   ├── loan.js
│   └── unit.js
├── tools/
│   ├── bmi.html
│   ├── image.html
│   ├── loan.html
│   └── unit.html
├── sitemap.xml
└── robots.txt
```

---

## 기술 스택 / Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Hosting:** Cloudflare Pages (정적 에셋 업로드 / static asset upload)
- **Monetization:** Google AdSense (준비 중 / pending approval)
- **빌드 도구 없음 / No build tools** — npm, webpack, bundler 모두 사용 안 함

---

## 배포 / Deployment

Cloudflare Pages → **Upload assets** 방식으로 `site/` 폴더 전체를 업로드합니다.  
Upload the entire `site/` directory via Cloudflare Pages → **Upload assets**.

배포 후 `sitemap.xml`과 `robots.txt`의 `your-domain.pages.dev`를 실제 도메인으로 교체하세요.  
After deploying, replace `your-domain.pages.dev` in `sitemap.xml` and `robots.txt` with the actual domain.

---

## 라이선스 / License

MIT
