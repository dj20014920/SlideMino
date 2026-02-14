# 블록 슬라이드 (Block Slide) - 2048 meets Tetris Puzzle Game

A modern, addictive browser-based puzzle game that combines 2048's merging mechanics with Tetris-style block placement. Built with React, TypeScript, and Vite.

🎮 **Play Now:** [slidemino.emozleep.space](https://slidemino.emozleep.space)

## ✨ Features

- **🎯 Multiple Difficulty Levels** - 10x10 Easy, 8x8 Normal, 7x7 Hard, 5x5 Extreme boards
- **🏆 Global Leaderboards** - Compete with players worldwide
- **🎨 Customizable Blocks** - Upload your own images
- **↩️ Undo System** - 3 undo moves per game
- **💾 Auto-Save** - Never lose your progress
- **📱 Fully Responsive** - Play on any device
- **🎭 Glass-Morphism Design** - Beautiful modern UI
- **📊 Anti-Cheat System** - Fair competitive play

## 🚀 Quick Start

**Prerequisites:** Node.js 18+

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run development server**
   ```bash
   npm run dev
   ```

3. **Build for production**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
블록 슬라이드 (Block Slide)/
├── components/          # React components (Board, Slot, Modals)
├── pages/              # Static pages (Privacy, Terms, About, Contact)
├── services/           # Game logic, storage, ranking
├── utils/              # Routing and utilities
├── context/            # React context providers
├── public/             # Static assets
│   ├── ads.txt        # AdSense verification
│   └── manifest.json  # PWA manifest
└── functions/          # Cloudflare Functions (API)
```

## 🎮 How to Play

1. **Place Blocks** - Drag and drop three pieces onto the board
2. **Merge Numbers** - Connect identical numbers to merge (2+2=4, 4+4=8, etc.)
3. **Slide Board** - Swipe in any direction to consolidate tiles
4. **Keep Going** - Plan ahead and achieve the highest score!

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** TailwindCSS, Glass-morphism
- **Backend:** Cloudflare Pages + Functions
- **Database:** Cloudflare D1 (SQLite)
- **Icons:** Lucide React
- **Hosting:** Cloudflare Pages
- **Monetization:** Google AdSense (web) + Google AdMob (native app)

## 📄 Pages & Routes

- `/` - Main game
- `/about` - Game guide and features
- `/privacy` - Privacy Policy
- `/terms` - Terms of Service
- `/contact` - Contact information

## 🔐 AdSense Integration

This project includes proper AdSense integration:
- ✅ `ads.txt` file with Publisher ID
- ✅ Privacy Policy page
- ✅ Terms of Service page
- ✅ Sufficient text content for crawlers
- ✅ Contact information

## 🌐 Web vs 📱 App Monetization (AdSense vs AdMob)

This codebase intentionally **separates web and native app ad stacks**:

- **Web (browser / Cloudflare Pages):** Google AdSense
   - Renders AdSense units in the DOM.
   - Uses a cookie-consent style flow appropriate for the web.
   - Keeps `ads.txt` and crawler-friendly pages for AdSense review.

- **Native App (Capacitor iOS/Android):** Google AdMob
   - Uses the native Google Mobile Ads SDK via `@capacitor-community/admob`.
   - Shows a native banner anchored to the bottom and the React UI simply reserves space.
   - Uses Google’s **User Messaging Platform (UMP)** flow (consent / privacy options) and iOS **ATT** handling.

### Why this split?

- **Policy & compliance:** Web cookie consent and in-app UMP/ATT are not interchangeable; each platform has its own expectations and SDK-level requirements.
- **UX stability:** Native banners are rendered outside the WebView; the app reserves bottom space to avoid covering gameplay.
- **Simplicity / DRY:** The app uses a single React entry point (`components/AdBanner.tsx`) and switches behavior based on platform detection.
- **Avoid mixed stacks:** AdSense should not run inside the native app build; the app build uses AdMob only.

### Where the behavior is implemented

- Platform routing: `utils/platform.ts`
- Single ad entry component: `components/AdBanner.tsx`
- Web consent storage/events: `services/adConsent.ts`
- Native (AdMob + UMP/ATT): `services/admob.ts`

## 📱 Mobile Support

Fully optimized for mobile devices using:
- Touch gestures for dragging and swiping
- Responsive design (works on phones/tablets)
- Install-to-homescreen metadata via `manifest.json` (service worker/offline app shell not enabled)

## 🚀 Deployment

### Cloudflare Pages

1. Connect your repository to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist`

## 📞 Contact

- **Email:** studio@emozleep.space
- **Website:** [slidemino.emozleep.space](https://slidemino.emozleep.space)

---

Made with ❤️ for puzzle game enthusiasts
