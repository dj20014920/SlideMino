import React from 'react';
import { Home, Mail, MessageCircle, Github, Send } from 'lucide-react';
import { withBackNavigation } from '../components/PageWithBackNavigation';

/**
 * Contact 페이지 - 연락처 정보 및 피드백 안내
 */
const Contact: React.FC = () => {
  return (
    <div className="policy-page contact-page">
      <header className="policy-header">
        <h1>Contact Us</h1>
        <p className="tagline">We'd love to hear from you!</p>
      </header>

      <div className="policy-content">
        <section className="intro-section">
          <h2>Get in Touch</h2>
          <p>
            Have a question, found a bug, or want to share feedback about SlideMino? We're here to help! 
            Whether you have technical issues, feature suggestions, or just want to say hello, feel free 
            to reach out using any of the methods below.
          </p>
          <p>
            We typically respond to all inquiries within 24-48 hours during business days. Your feedback 
            helps us improve the game and create a better experience for all players!
          </p>
        </section>

        <section className="contact-methods">
          <h2>Contact Methods</h2>
          
          <div className="contact-cards">
            <div className="contact-card">
              <div className="card-icon">
                <Mail size={32} />
              </div>
              <h3>Email</h3>
              <p>The primary way to reach us for all inquiries, bug reports, feedback, or support requests.</p>
              <div className="contact-details">
                <p><strong>Contact Email:</strong></p>
                <a href="mailto:studio@emozleep.space" className="text-lg font-semibold">studio@emozleep.space</a>
                
                <p className="mt-4 text-sm">
                  We handle all types of inquiries: general questions, bug reports, privacy requests, 
                  feature suggestions, and business partnerships. Just email us and we'll respond within 24-48 hours!
                </p>
              </div>
            </div>

            <div className="contact-card">
              <div className="card-icon">
                <MessageCircle size={32} />
              </div>
              <h3>Feedback Form</h3>
              <p>Quick and easy way to send us your thoughts, suggestions, or report issues.</p>
              <div className="contact-details">
                <p>
                  We value your input! Share your ideas for new features, report bugs you've encountered, 
                  or let us know what you love about the game.
                </p>
                <a href="mailto:studio@emozleep.space?subject=SlideMino Feedback" className="action-link">
                  <Send size={18} />
                  <span>Send Feedback</span>
                </a>
              </div>
            </div>

            <div className="contact-card">
              <div className="card-icon">
                <Github size={32} />
              </div>
              <h3>Developer</h3>
              <p>Connect with the developer and stay updated on the latest changes and features.</p>
              <div className="contact-details">
                <p>
                  Follow the development of SlideMino and contribute to its growth. Check out our 
                  development updates and technical documentation.
                </p>
                <p className="dev-note">Developer contact available via email inquiries.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="what-to-include">
          <h2>When Contacting Us</h2>
          <p>To help us assist you better, please include the following information when reaching out:</p>
          
          <h3>🐛 For Bug Reports:</h3>
          <ul>
            <li><strong>Description:</strong> What happened? What did you expect to happen?</li>
            <li><strong>Steps to Reproduce:</strong> Detailed steps to recreate the issue</li>
            <li><strong>Device & Browser:</strong> What device and browser are you using? (e.g., "iPhone 14, Safari 17")</li>
            <li><strong>Game State:</strong> What difficulty level? What was your score?</li>
            <li><strong>Screenshots:</strong> If possible, attach screenshots showing the problem</li>
            <li><strong>Console Errors:</strong> Any error messages you see (press F12 in browser)</li>
          </ul>

          <h3>💡 For Feature Suggestions:</h3>
          <ul>
            <li><strong>Feature Description:</strong> Clearly describe the feature you'd like to see</li>
            <li><strong>Use Case:</strong> Why would this feature be useful?</li>
            <li><strong>Examples:</strong> Any examples from other games or apps?</li>
            <li><strong>Priority:</strong> How important is this to your experience?</li>
          </ul>

          <h3>❓ For General Questions:</h3>
          <ul>
            <li><strong>Subject:</strong> Brief summary of your question</li>
            <li><strong>Details:</strong> Provide context and any relevant information</li>
            <li><strong>Urgency:</strong> Is this time-sensitive?</li>
          </ul>

          <h3>🔒 For Privacy & Data Requests:</h3>
          <ul>
            <li><strong>Request Type:</strong> Access, deletion, correction, or portability?</li>
            <li><strong>Identification:</strong> Nickname used on leaderboards (if applicable)</li>
            <li><strong>Specific Data:</strong> What data are you inquiring about?</li>
          </ul>
        </section>

        <section className="faq-section">
          <h2>Before You Contact</h2>
          <p>Your question might already be answered! Check these resources first:</p>
          
          <div className="quick-links">
            <a href="#/about" className="quick-link-card">
              <h3>📖 About & How to Play</h3>
              <p>Complete guide on gameplay mechanics, strategies, and features</p>
            </a>

            <a href="#/privacy" className="quick-link-card">
              <h3>🔒 Privacy Policy</h3>
              <p>Information about data collection, usage, and your privacy rights</p>
            </a>

            <a href="#/terms" className="quick-link-card">
              <h3>📜 Terms of Service</h3>
              <p>Rules, guidelines, and legal information about using SlideMino</p>
            </a>
          </div>
        </section>

        <section className="common-issues">
          <h2>Common Issues & Quick Fixes</h2>
          
          <div className="issue-item">
            <h3>🎮 Game Won't Load or Freezes</h3>
            <ul>
              <li>Clear your browser cache and reload the page</li>
              <li>Try using a different browser (Chrome, Firefox, or Safari)</li>
              <li>Check your internet connection</li>
              <li>Disable browser extensions that might interfere</li>
              <li>Make sure JavaScript is enabled in your browser</li>
            </ul>
          </div>

          <div className="issue-item">
            <h3>💾 Lost My Game Progress</h3>
            <ul>
              <li>Game progress is saved in browser local storage</li>
              <li>Clearing browser data will erase saved games</li>
              <li>Using incognito/private mode doesn't save progress</li>
              <li>Different browsers have separate saved games</li>
              <li>On mobile, switching between browsers won't transfer saves</li>
            </ul>
          </div>

          <div className="issue-item">
            <h3>🏆 Leaderboard Submission Failed</h3>
            <ul>
              <li>Check your internet connection</li>
              <li>Make sure you're using a valid nickname (no special characters)</li>
              <li>Verify your score meets minimum requirements</li>
              <li>If the issue persists, contact us with your score details</li>
            </ul>
          </div>

          <div className="issue-item">
            <h3>📱 Mobile Touch Issues</h3>
            <ul>
              <li>Make sure you're using a modern browser</li>
              <li>Try refreshing the page</li>
              <li>Close other apps that might be using memory</li>
              <li>Rotate your device and back for better fit</li>
              <li>Update your mobile browser to the latest version</li>
            </ul>
          </div>

          <div className="issue-item">
            <h3>🎨 Custom Blocks Not Loading</h3>
            <ul>
              <li>Ensure your image file is under 2MB</li>
              <li>Use common formats: JPG, PNG, or WebP</li>
              <li>Try uploading a different image</li>
              <li>Clear customizations and try again</li>
              <li>Check browser console for specific error messages</li>
            </ul>
          </div>
        </section>

        <section className="response-time">
          <h2>Response Times</h2>
          <p>We strive to respond to all inquiries promptly:</p>
          <ul>
            <li><strong>General Questions:</strong> 24-48 hours</li>
            <li><strong>Bug Reports:</strong> 1-3 business days</li>
            <li><strong>Feature Requests:</strong> Acknowledged within 1 week</li>
            <li><strong>Privacy Requests:</strong> Within 30 days (as required by law)</li>
            <li><strong>Business Inquiries:</strong> 3-5 business days</li>
          </ul>
          <p className="note">
            Note: Response times may be longer during holidays or periods of high volume. 
            We appreciate your patience!
          </p>
        </section>

        <section className="stay-updated">
          <h2>Stay Updated</h2>
          <p>
            Want to know about new features, updates, and improvements to SlideMino? 
            Send us an email at <a href="mailto:studio@emozleep.space">studio@emozleep.space</a> expressing 
            interest in updates, and we'll keep you in the loop!
          </p>
          <p>
            We periodically share information about:
          </p>
          <ul>
            <li>New game features and improvements</li>
            <li>Special events or competitions</li>
            <li>Major bug fixes and updates</li>
            <li>Tips and strategies from top players</li>
          </ul>
        </section>

        <section className="thank-you">
          <h2>Thank You!</h2>
          <p>
            Thank you for taking the time to reach out. Your feedback, questions, and suggestions 
            are incredibly valuable in making SlideMino better for everyone. We read every message 
            and take your input seriously.
          </p>
          <p>
            Whether you're reporting a bug, sharing an idea, or just saying hi, we appreciate you 
            being part of the SlideMino community! 🎮💙
          </p>
        </section>

        <div className="contact-cta">
          <a href="mailto:studio@emozleep.space" className="cta-button">
            <Mail size={24} />
            <span>Send Us an Email</span>
          </a>
        </div>
      </div>

      <a href="#/" className="back-to-game">
        <Home size={20} />
        <span>Back to Game</span>
      </a>
    </div>
  );
};

export default withBackNavigation(Contact);
