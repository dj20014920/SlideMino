import React from 'react';
import { Home, Gamepad2, Target, Zap, Trophy, Palette, RotateCw } from 'lucide-react';
import { withBackNavigation } from '../components/PageWithBackNavigation';

/**
 * About 페이지 - 게임 소개 및 플레이 가이드
 * SEO를 위한 충분한 텍스트 콘텐츠 제공
 */
const About: React.FC = () => {
  return (
    <div className="policy-page about-page">
      <header className="policy-header">
        <h1>About 블록 슬라이드 (Block Slide)</h1>
        <p className="tagline">The Perfect Blend of 2048 and Tetris</p>
      </header>

      <div className="policy-content">
        <section className="intro-section">
          <h2>What is 블록 슬라이드 (Block Slide)?</h2>
          <p>
            블록 슬라이드 (Block Slide) is an innovative browser-based puzzle game that brilliantly combines the addictive 
            number-merging mechanics of 2048 with the strategic block placement of Tetris. Created for 
            puzzle enthusiasts who love a challenge, 블록 슬라이드 (Block Slide) offers a unique gameplay experience that 
            tests your spatial reasoning, strategic planning, and quick thinking.
          </p>
          <p>
            Whether you're looking for a quick brain teaser during your coffee break or an engaging puzzle 
            to master over time, 블록 슬라이드 (Block Slide) provides endless entertainment with its elegant glass-morphism 
            design and smooth animations. Best of all, it's completely free to play and works seamlessly 
            on any modern web browser!
          </p>
        </section>

        <section className="how-to-play">
          <h2><Gamepad2 size={28} /> How to Play</h2>
          
          <div className="gameplay-steps">
            <div className="step">
              <h3>Step 1: Place Blocks</h3>
              <p>
                You start with three randomly generated Tetris-style pieces at the bottom of the screen. 
                Each piece contains cells that will place number tiles (starting with value 1) on the board. 
                Drag and drop these pieces onto the game board, fitting them into available spaces. You can 
                rotate pieces by pressing 'R' while dragging!
              </p>
            </div>

            <div className="step">
              <h3>Step 2: Merge Numbers</h3>
              <p>
                When you place a piece, if any cells land adjacent to tiles with the same number, they 
                automatically merge! This follows 2048 rules: identical numbers combine into the next value 
                (1+1=2, 2+2=4, 4+4=8, etc.). Strategic placement can trigger chain reactions of multiple merges!
              </p>
            </div>

            <div className="step">
              <h3>Step 3: Slide or Skip</h3>
              <p>
                After placing all three pieces, you must slide the board in any direction (up, down, left, or right) 
                to consolidate tiles. However, if merges occurred during placement, you have the option to skip 
                the slide and place more pieces immediately. This adds strategic depth - sometimes it's better 
                to keep your current layout!
              </p>
            </div>

            <div className="step">
              <h3>Step 4: Manage Your Space</h3>
              <p>
                The game continues as you receive new sets of pieces. Plan carefully to avoid filling the board 
                completely. The game ends when no piece can be placed in any position with any rotation. Your 
                goal is to achieve the highest possible score through strategic merging!
              </p>
            </div>
          </div>
        </section>

        <section className="features">
          <h2><Zap size={28} /> Key Features</h2>
          
          <div className="feature-grid">
            <div className="feature-item">
              <Target size={24} />
              <h3>Multiple Difficulty Levels</h3>
              <p>
                Choose from four board sizes to match your skill level: 10x10 (Easy), 8x8 (Normal), 
                7x7 (Hard), and 5x5 (Extreme). Each level offers a unique challenge with different strategic requirements.
              </p>
            </div>

            <div className="feature-item">
              <Trophy size={24} />
              <h3>Global Leaderboards</h3>
              <p>
                Compete with players worldwide! Submit your high scores to our online leaderboard and see how 
                you rank against the best 블록 슬라이드 (Block Slide) players. Can you reach the top 10?
              </p>
            </div>

            <div className="feature-item">
              <Palette size={24} />
              <h3>Block Customization</h3>
              <p>
                Personalize your gaming experience with custom block designs. Upload your own images to create 
                unique block appearances, or use our beautiful default glass-morphism style.
              </p>
            </div>

            <div className="feature-item">
              <RotateCw size={24} />
              <h3>Undo System</h3>
              <p>
                Made a mistake? No problem! Each game provides three undo opportunities to revert your last 
                move. Use them wisely to recover from critical errors and optimize your strategy.
              </p>
            </div>

            <div className="feature-item">
              <Gamepad2 size={24} />
              <h3>Smooth Animations</h3>
              <p>
                Enjoy fluid, eye-catching animations as tiles merge, slide, and disappear. Our carefully 
                crafted visual effects make every move satisfying and keep you engaged for hours.
              </p>
            </div>

            <div className="feature-item">
              <Zap size={24} />
              <h3>Auto-Save Progress</h3>
              <p>
                Your game progress is automatically saved locally on your device. Close the browser and come 
                back anytime to continue exactly where you left off. No account required!
              </p>
            </div>
          </div>
        </section>

        <section className="strategy-tips">
          <h2>Pro Strategy Tips</h2>
          
          <div className="tips-list">
            <div className="tip">
              <h3>🎯 Plan Multiple Moves Ahead</h3>
              <p>
                Don't just focus on the current pieces. Look at all three pieces available and plan how 
                they'll work together. Consider which direction you'll slide after placing them.
              </p>
            </div>

            <div className="tip">
              <h3>🏗️ Build in Corners</h3>
              <p>
                Try to build your highest numbers in one corner of the board. This creates a "cascade" 
                effect where numbers naturally merge as you slide, keeping that area organized.
              </p>
            </div>

            <div className="tip">
              <h3>⚡ Create Merge Chains</h3>
              <p>
                Position identical numbers near each other to create chain reactions. A single placement 
                can trigger multiple merges, dramatically boosting your score and clearing space.
              </p>
            </div>

            <div className="tip">
              <h3>🔄 Don't Over-Slide</h3>
              <p>
                If merges happen during piece placement, you have the option to skip the slide phase. 
                Sometimes it's better to keep your board layout intact rather than sliding unnecessarily.
              </p>
            </div>

            <div className="tip">
              <h3>🎲 Manage Empty Space</h3>
              <p>
                Always maintain multiple empty areas on your board. This gives you flexibility to place 
                awkwardly shaped pieces and recover from difficult situations.
              </p>
            </div>

            <div className="tip">
              <h3>💡 Use Undo Strategically</h3>
              <p>
                Save your three undo moves for critical mistakes or to experiment with risky strategies. 
                Don't waste them on minor placements that could be easily recovered.
              </p>
            </div>
          </div>
        </section>

        <section className="technical-specs">
          <h2>Technical Information</h2>
          
          <h3>Platform & Compatibility</h3>
          <ul>
            <li><strong>Platform:</strong> Web-based (runs in any modern browser)</li>
            <li><strong>Technology:</strong> Built with React, TypeScript, and Vite</li>
            <li><strong>Supported Browsers:</strong> Chrome, Firefox, Safari, Edge (latest versions)</li>
            <li><strong>Mobile Support:</strong> Fully responsive design for tablets and smartphones</li>
            <li><strong>Offline Play:</strong> Web: playable in the current loaded session; reload/new visit requires network (no service worker). Native app: core gameplay works offline after install.</li>
            <li><strong>Data Storage:</strong> Browser local storage (no server account needed for single-player)</li>
          </ul>

          <h3>Performance</h3>
          <ul>
            <li><strong>Loading Time:</strong> Instant (under 2 seconds on standard connections)</li>
            <li><strong>Frame Rate:</strong> Smooth 60 FPS animations</li>
            <li><strong>Storage Required:</strong> Minimal (less than 5MB total including assets)</li>
            <li><strong>Network Requirements:</strong> Optional (only needed for leaderboards and ads)</li>
          </ul>
        </section>

        <section className="game-modes">
          <h2>Game Modes Explained</h2>
          
          <div className="mode-details">
            <div className="mode">
              <h3>🟢 Easy Mode (10x10 Board)</h3>
              <p>
                Perfect for beginners and casual players. The 10x10 grid provides ample space to 
                learn the mechanics and develop basic strategies. Great for relaxed 10-15 minute sessions.
              </p>
              <ul>
                <li>Board Size: 10 rows × 10 columns (100 cells)</li>
                <li>Average Game Time: 10-20 minutes</li>
                <li>Difficulty: Beginner-friendly</li>
                <li>Best For: Learning the game, casual play</li>
              </ul>
            </div>

            <div className="mode">
              <h3>🟡 Normal Mode (8x8 Board)</h3>
              <p>
                The balanced choice for regular players. The 8x8 grid offers a good mix of challenge 
                and playability, making it the most popular mode among experienced players.
              </p>
              <ul>
                <li>Board Size: 8 rows × 8 columns (64 cells)</li>
                <li>Average Game Time: 15-25 minutes</li>
                <li>Difficulty: Intermediate challenge</li>
                <li>Best For: Regular players, strategic gameplay</li>
              </ul>
            </div>

            <div className="mode">
              <h3>🔴 Hard Mode (7x7 Board)</h3>
              <p>
                For skilled players seeking a real challenge. The 7x7 grid demands careful planning 
                and efficient space management. Every move counts!
              </p>
              <ul>
                <li>Board Size: 7 rows × 7 columns (49 cells)</li>
                <li>Average Game Time: 20-30 minutes</li>
                <li>Difficulty: Advanced level</li>
                <li>Best For: Experienced players, high score hunters</li>
              </ul>
            </div>

            <div className="mode">
              <h3>⚫ Extreme Mode (5x5 Board)</h3>
              <p>
                The ultimate test for puzzle masters. The 5x5 grid is brutally difficult, requiring 
                exceptional spatial awareness and near-perfect play. Only the most dedicated players 
                can achieve high scores here.
              </p>
              <ul>
                <li>Board Size: 5 rows × 5 columns (25 cells)</li>
                <li>Average Game Time: 10-20 minutes (if you survive!)</li>
                <li>Difficulty: Expert/Extreme level</li>
                <li>Best For: Hardcore players, ultimate challenge</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="scoring-system">
          <h2>Scoring System</h2>
          <p>Understanding how scoring works helps you maximize your points:</p>
          <ul>
            <li><strong>Merge Points:</strong> Each merge awards points equal to the resulting number. 
            When tiles merge (e.g., 2+2=4), you earn points based on the new value (4 points in this case).</li>
            <li><strong>Starting Values:</strong> Placed pieces start with value 1. Through strategic placement 
            and merging, you can build up to much higher values (128, 256, 512+).</li>
            <li><strong>Chain Reactions:</strong> Multiple merges from a single slide action can dramatically 
            boost your score. Plan your slides to create cascading merge opportunities!</li>
            <li><strong>Placement Merges:</strong> Merges that occur immediately when placing a piece contribute 
            to your score and give you the option to skip the slide phase.</li>
            <li><strong>Anti-Cheat Verification:</strong> Score submissions include game duration and move count 
            to ensure fair competition on the leaderboards.</li>
          </ul>
        </section>

        <section className="faq">
          <h2>Frequently Asked Questions (FAQ)</h2>
          
          <div className="faq-item">
            <h3>Q: Is 블록 슬라이드 (Block Slide) free to play?</h3>
            <p>
              <strong>A:</strong> Yes! 블록 슬라이드 (Block Slide) is completely free to play with no hidden costs, subscriptions, 
              or paywalls. We support the game through non-intrusive advertisements.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: Do I need to create an account?</h3>
            <p>
              <strong>A:</strong> No account is required for playing. Your game progress is automatically saved 
              locally. You only need to provide a nickname if you want to submit scores to the global leaderboard.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: Can I play on mobile devices?</h3>
            <p>
              <strong>A:</strong> Absolutely! 블록 슬라이드 (Block Slide) features a fully responsive design that works beautifully 
              on smartphones and tablets. Simply visit the website in your mobile browser.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: How does the leaderboard work?</h3>
            <p>
              <strong>A:</strong> After completing a game, you can submit your score with a nickname. Scores are 
              ranked globally by difficulty level. We use anti-cheat measures to ensure fair competition.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: What happens if I close my browser?</h3>
            <p>
              <strong>A:</strong> Your active game is automatically saved. When you return, you'll be able to 
              continue exactly where you left off. No progress is lost!
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: Can I customize the game appearance?</h3>
            <p>
              <strong>A:</strong> Yes! Use the customization feature to upload custom images for your blocks. 
              Create unique visual themes to personalize your experience.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: How do I report bugs or provide feedback?</h3>
            <p>
              <strong>A:</strong> We'd love to hear from you! Visit our <a href="#/contact">Contact Page</a> or 
              email us directly at <a href="mailto:studio@emozleep.space">studio@emozleep.space</a> to 
              send us your feedback, bug reports, or suggestions for improvement.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: Are there any keyboard shortcuts?</h3>
            <p>
              <strong>A:</strong> Yes! Use arrow keys (↑↓←→) to slide the board after placing pieces. This 
              provides a faster alternative to swiping with your mouse or touch.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: What's the highest possible number?</h3>
            <p>
              <strong>A:</strong> Theoretically unlimited! Players have achieved numbers beyond 4096. The highest 
              numbers require exceptional strategy and often appear in the Expert (12x12) mode.
            </p>
          </div>

          <div className="faq-item">
            <h3>Q: Can I play offline?</h3>
            <p>
              <strong>A:</strong> On the web, core gameplay continues offline only while the already-loaded session stays open. 
              If you refresh or open the site from a new tab while offline, the app cannot boot because there is no service worker cache. 
              In the native app build (iOS/Android), core gameplay works offline after installation. In both cases, leaderboard sync and ads require internet.
            </p>
          </div>
        </section>

        <section className="about-developer">
          <h2>About the Developer</h2>
          <p>
            블록 슬라이드 (Block Slide) was created with passion by an independent game developer who loves puzzle games and 
            clean, elegant design. The goal was to create a game that's easy to learn but impossible to master, 
            providing entertainment for players of all skill levels.
          </p>
          <p>
            The game continues to be actively maintained and improved based on player feedback. New features, 
            optimizations, and refinements are regularly added to enhance the gaming experience.
          </p>
          <p>
            Thank you for playing 블록 슬라이드 (Block Slide)! We hope you enjoy the game as much as we enjoyed creating it. 
            Happy sliding! 🎮✨
          </p>
        </section>

        <section className="get-started">
          <h2>Ready to Play?</h2>
          <p>
            Now that you know all about 블록 슬라이드 (Block Slide), it's time to put your skills to the test! 
            Click the button below to start your puzzle journey.
          </p>
          <a href="#/" className="cta-button">
            <Gamepad2 size={24} />
            <span>Start Playing Now</span>
          </a>
        </section>
      </div>

      <a href="#/" className="back-to-game">
        <Home size={20} />
        <span>Back to Game</span>
      </a>
    </div>
  );
};

export default withBackNavigation(About);
