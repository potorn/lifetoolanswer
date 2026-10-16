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
Built with plain HTML + CSS + JS. No framework, package manager, or required build step; browser libraries are vendored locally.

---

## 제공 도구 / Tools

| 도구 | 설명 | Tool | Description |
|------|------|------|-------------|
| [BMI 계산기](tools/bmi.html) | 체질량지수 계산 (대한비만학회 기준) | BMI Calculator | Uses Korean Society for the Study of Obesity cutoffs |
| [기초대사량·칼로리 계산기](tools/bmr.html) | 휴식 시·활동량별 하루 소모 열량 추정 | Energy Calculator | Adult REE estimates and illustrative activity factors |
| [걷기·달리기 페이스 계산기](tools/pace.html) | 거리·시간·페이스 상호 계산, km·마일 지원 | Pace Calculator | Pace, time, distance and speed conversions |
| [이미지 포맷 변환기](tools/image.html) | PNG · JPG · WebP · BMP · ICO · AVIF · TGA 출력 (GIF 입력 지원) | Image Format Converter | Convert image formats locally; GIF output belongs to GIF Maker |
| [이미지 편집기](tools/image-editor.html) | 자유·비율 크롭, 색상·레벨 보정, 텍스트, 회전·뒤집기 | Image Editor | Local canvas editing, undo/redo and PNG/JPEG/WebP export |
| [GIF 만들기](tools/gif-maker.html) | 사진 여러 장·짧은 동영상으로 GIF 만들기 | GIF Maker | Create GIFs from photos or short videos in the browser |
| [대출 계산기](tools/loan.html) | 원리금균등 / 원금균등 / 만기일시 상환 | Loan Calculator | Equal payment / Equal principal / Bullet repayment |
| [단위 변환기](tools/unit.html) | 길이 · 무게 · 온도 · 넓이 · 부피 | Unit Converter | Length, weight, temperature, area, volume |
| [연봉 실수령액 계산기](tools/salary.html) | 4대보험·소득세 예상 공제 | Salary Calculator | Estimated payroll deductions |
| [퍼센트 계산기](tools/percent.html) | 할인·증감률·역계산 | Percentage Calculator | Discount, change rate, reverse calculation |
| [부가세 계산기](tools/vat.html) | 공급가액·부가세·합계 역산 | VAT Calculator | Add or reverse 10% VAT |
| [글자 수 계산기](tools/text-counter.html) | 공백 포함·제외·UTF-8 바이트 | Text Counter | Graphemes, words, lines, UTF-8 bytes |
| [예금·적금 계산기](tools/savings.html) | 세전·세후 만기금액 예상 | Savings Calculator | Deposit and installment interest |
| [QR 코드 생성기](tools/qr.html) | URL·텍스트를 PNG QR로 생성 | QR Generator | Local PNG QR generation |
| [인코딩·디코딩](tools/encoder.html) | Base64·URL 인코딩과 디코딩 | Encoder / Decoder | UTF-8 Base64 and URL conversion |
| [SHA 해시 생성기](tools/hash.html) | SHA-256·SHA-512 문자열 해시 | Hash Generator | Local SHA-256 and SHA-512 hashing |
| [암호화·복호화](tools/encryption.html) | AES-GCM·키워드·문자 치환 | Encryption Tool | AES-GCM and educational ciphers |

---

## 로컬 실행 / Running Locally

```bash
python -m http.server 8080 --directory D:\ai_dev\site
```

브라우저에서 `http://localhost:8080` 접속  
Then open `http://localhost:8080` in your browser.

필수 빌드 스텝 없음 — 파일을 직접 수정하고 브라우저를 새로고침하면 됩니다.
No build required — edit a file and refresh the browser.

이미지 도구 회귀 검사는 Node.js 22 이상에서 `node scripts/check-image-tools.mjs`로 실행합니다. 별도 패키지 설치 없이 색상 보정, 비동기 변환 요청, 결과 파일명과 실제 WASM 변환·GIF 제작을 확인합니다.

건강 도구 회귀 검사는 `node scripts/check-health-tools.mjs`로 실행합니다. 대사량 식, 성인 입력 범위, 페이스·시간·거리 역산, 마일 환산, 초 단위 반올림을 확인합니다. 칼로리는 Mifflin–St Jeor 간략식과 고정 예시 활동계수 1.4·1.6·1.8·2.0을 사용하며, 두 도구 모두 외부 API나 주기적으로 갱신하는 요율·음식 데이터가 필요하지 않습니다.

업로드한 이미지·동영상과 도구 입력값은 브라우저에서 처리되며 생활도구 서버로 전송하거나 저장하지 않습니다. 실행에 필요한 글꼴·스크립트·WASM도 사이트 내부 정적 자산으로 제공합니다.

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
│   ├── bmr.js
│   ├── pace.js
│   ├── encoder.js
│   ├── encryption.js
│   ├── gif-maker.js
│   ├── hash.js
│   ├── image.js
│   ├── image-editor.js
│   ├── loan.js
│   ├── qr.js
│   ├── savings.js
│   ├── text-counter.js
│   ├── unit.js
│   └── vat.js
├── tools/
│   ├── bmi.html
│   ├── bmr.html
│   ├── pace.html
│   ├── encoder.html
│   ├── encryption.html
│   ├── gif-maker.html
│   ├── hash.html
│   ├── image.html
│   ├── image-editor.html
│   ├── loan.html
│   ├── qr.html
│   ├── savings.html
│   ├── text-counter.html
│   ├── unit.html
│   └── vat.html
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

GitHub의 `main` 브랜치에 푸시하면 Cloudflare Pages가 자동 배포합니다. 로컬 `master` 브랜치에서는 `git push origin master:main`을 실행합니다.

Cloudflare Pages automatically deploys pushes to GitHub `main`. From the local `master` branch, run `git push origin master:main`.

FFmpeg WASM은 Cloudflare 단일 자산 제한을 피하기 위해 `vendor/ffmpeg/ffmpeg-core.wasm.gz`로 배포되며, 브라우저의 로컬 워커에서 압축을 풉니다. 원본 `ffmpeg-core.wasm`은 `.assetsignore`로 배포 대상에서 제외되고 공개 소스 저장소에 보존됩니다. 압축 파일은 `node scripts/compress-ffmpeg-core.mjs`로 재생성할 수 있습니다.

운영 도메인은 `https://lifetoolanswer.com`이며 사이트맵과 canonical URL도 이 도메인을 사용합니다.

---

## 라이선스 / License

MIT
