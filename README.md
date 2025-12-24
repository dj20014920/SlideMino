# SlideMino - 2048 meets Tetris Puzzle Game

A modern, addictive browser-based puzzle game that combines 2048's merging mechanics with Tetris-style block placement. Built with React, TypeScript, and Vite.

🎮 **Play Now:** [www.slidemino.emozleep.space](https://www.slidemino.emozleep.space)

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
SlideMino/
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
- **Monetization:** Google AdSense

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

## 📱 Mobile Support

Fully optimized for mobile devices using:
- Touch gestures for dragging and swiping
- Responsive design (works on phones/tablets)
- PWA support for install-to-homescreen

## 🚀 Deployment

### Cloudflare Pages

1. Connect your repository to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist`

## 📞 Contact

- **Email:** studio@emozleep.space
- **Website:** [www.slidemino.emozleep.space](https://www.slidemino.emozleep.space)

---

Made with ❤️ for puzzle game enthusiasts
