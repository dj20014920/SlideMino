import React from 'react';
import { Home } from 'lucide-react';

/**
 * 개인정보 처리방침 페이지
 * Google AdSense 정책 요구사항 충족 및 사용자 정보 보호 명시
 */
const PrivacyPolicy: React.FC = () => {
  return (
    <div className="policy-page">
      <header className="policy-header">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last Updated: December 20, 2025</p>
      </header>

      <div className="policy-content">
        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to SlideMino. We are committed to protecting your privacy and ensuring transparency 
            about how we collect, use, and protect your information. This Privacy Policy explains our 
            practices regarding data collection and usage.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          
          <h3>2.1 Information You Provide</h3>
          <ul>
            <li><strong>Player Name:</strong> You may provide a nickname when playing the game to appear on leaderboards.</li>
            <li><strong>Contact Information:</strong> Email addresses if you contact us for support or feedback.</li>
          </ul>

          <h3>2.2 Automatically Collected Information</h3>
          <ul>
            <li><strong>Game Data:</strong> High scores, game progress, and settings stored locally on your device using browser local storage.</li>
            <li><strong>Usage Data:</strong> Game interactions, play patterns, and feature usage for improving user experience.</li>
            <li><strong>Technical Data:</strong> Browser type, device information, IP address, and operating system for compatibility and security.</li>
          </ul>

          <h3>2.3 Cookies and Similar Technologies</h3>
          <p>
            We use cookies and local storage to save your game progress, preferences, and provide 
            personalized experiences. You can control cookies through your browser settings.
          </p>
        </section>

        <section>
          <h2>3. Advertising (Google AdSense / Google AdMob)</h2>
          <p>
            SlideMino displays advertisements to support the free service. On the web version we use Google AdSense, and on the
            native mobile app version (iOS/Android) we may use Google AdMob.
          </p>
          <p>
            Depending on your consent choices and platform capabilities, ads may be personalized or non-personalized.
          </p>
          <p>
            On the web version, Google may use cookies and similar technologies to serve ads based on your prior visits.
          </p>
          
          <h3>3.1 Third-Party Advertising</h3>
          <ul>
            <li>Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet.</li>
            <li>You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.</li>
            <li>You can also visit <a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">aboutads.info</a> to opt out of third-party vendors' use of cookies for personalized advertising.</li>
          </ul>

          <h3>3.2 AdSense / AdMob Partner Information</h3>
          <p>
            Google advertising products (such as AdSense and AdMob) may use cookies and/or device identifiers to provide and
            measure ads. For more information about Google's privacy practices, please visit the{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
          </p>
        </section>

        <section>
          <h2>4. How We Use Your Information</h2>
          <ul>
            <li><strong>Game Functionality:</strong> To save your progress, maintain leaderboards, and provide core game features.</li>
            <li><strong>Improvement:</strong> To analyze usage patterns and improve game design and performance.</li>
            <li><strong>Communication:</strong> To respond to your inquiries and provide customer support.</li>
            <li><strong>Security:</strong> To detect and prevent fraud, abuse, or technical issues.</li>
            <li><strong>Advertising:</strong> To display relevant ads through Google AdSense (web) and/or Google AdMob (native app).</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Storage and Security</h2>
          <p>
            Your game data is primarily stored locally on your device using browser local storage. 
            Leaderboard data is stored securely on our servers with appropriate security measures including:
          </p>
          <ul>
            <li>Encryption of data in transit using HTTPS/SSL</li>
            <li>Access controls and authentication for server data</li>
            <li>Regular security audits and updates</li>
            <li>Anti-cheat mechanisms to ensure fair play</li>
          </ul>
          <p>
            However, no method of transmission over the Internet is 100% secure. While we strive to protect 
            your information, we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2>6. Data Sharing and Disclosure</h2>
          <p>We do not sell, trade, or rent your personal information. We may share data only in the following circumstances:</p>
          <ul>
            <li><strong>With Your Consent:</strong> When you explicitly agree to share information.</li>
            <li><strong>Service Providers:</strong> With trusted partners like Google AdSense and/or Google AdMob who help operate our service.</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
          </ul>
        </section>

        <section>
          <h2>7. Your Rights and Choices</h2>
          <p>You have the following rights regarding your information:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your data stored on our servers.</li>
            <li><strong>Deletion:</strong> Clear your local game data at any time through browser settings. Request deletion of server-side data by contacting us.</li>
            <li><strong>Correction:</strong> Update or correct your information by contacting us.</li>
            <li><strong>Opt-Out:</strong> Disable cookies through browser settings or opt out of personalized ads through Google Ads Settings.</li>
            <li><strong>Data Portability:</strong> Request your data in a portable format.</li>
          </ul>
        </section>

        <section>
          <h2>8. Children's Privacy</h2>
          <p>
            SlideMino is intended for general audiences and does not knowingly collect personal information 
            from children under 13 years of age. If we discover that we have collected information from a 
            child under 13, we will promptly delete it. Parents who believe their child has provided information 
            to us should contact us immediately.
          </p>
        </section>

        <section>
          <h2>9. International Users</h2>
          <p>
            SlideMino is hosted on Cloudflare's global network. Your information may be transferred to and 
            processed in countries other than your own. We ensure appropriate safeguards are in place to 
            protect your data in accordance with this Privacy Policy.
          </p>
        </section>

        <section>
          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes 
            by posting the new policy on this page with an updated "Last Updated" date. Your continued use 
            of SlideMino after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2>11. Contact Us</h2>
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy or your personal 
            information, please contact us:
          </p>
          <ul>
            <li><strong>Email:</strong> studio@emozleep.space</li>
            <li><strong>Website:</strong> <a href="https://www.slidemino.emozleep.space/#/contact">Contact Page</a></li>
          </ul>
          <p>We will respond to all requests within 30 days.</p>
        </section>

        <section>
          <h2>12. Third-Party Links</h2>
          <p>
            SlideMino may contain links to third-party websites or services. We are not responsible for the 
            privacy practices of these external sites. We encourage you to review their privacy policies 
            before providing any personal information.
          </p>
        </section>
      </div>

      <a href="#/" className="back-to-game">
        <Home size={20} />
        <span>Back to Game</span>
      </a>
    </div>
  );
};

export default PrivacyPolicy;
