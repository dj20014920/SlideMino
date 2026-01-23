import React from 'react';
import { Home } from 'lucide-react';
import { withBackNavigation } from '../components/PageWithBackNavigation';

/**
 * 이용약관 페이지
 * 서비스 이용 규칙 및 법적 책임 명시
 */
const Terms: React.FC = () => {
  return (
    <div className="policy-page">
      <header className="policy-header">
        <h1>Terms of Service</h1>
        <p className="last-updated">Last Updated: December 20, 2025</p>
      </header>

      <div className="policy-content">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            Welcome to SlideMino! By accessing or using our game at www.slidemino.emozleep.space 
            (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not 
            agree to these Terms, please do not use the Service.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and SlideMino ("we," "us," or "our"). 
            We reserve the right to modify these Terms at any time. Your continued use of the Service after 
            changes constitutes acceptance of the modified Terms.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            SlideMino is a free-to-play browser-based puzzle game that combines elements of 2048 and Tetris. 
            The Service includes:
          </p>
          <ul>
            <li>Core gameplay featuring block placement and number merging mechanics</li>
            <li>Multiple difficulty levels (10x10 Easy, 8x8 Normal, 7x7 Hard, 5x5 Extreme boards)</li>
            <li>Online leaderboard system to compete with other players</li>
            <li>Local game progress saving and customization features</li>
            <li>Advertisement display through Google AdSense (web) and/or Google AdMob (native app)</li>
          </ul>
          <p>
            We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time 
            without prior notice.
          </p>
        </section>

        <section>
          <h2>3. User Eligibility</h2>
          <p>
            The Service is available to users of all ages. However, if you are under 13 years of age, you 
            must have parental or guardian consent to use the Service. By using the Service, you represent 
            that you meet these eligibility requirements.
          </p>
          <p>
            Users are responsible for ensuring that their use of the Service complies with all applicable 
            local, state, national, and international laws and regulations.
          </p>
        </section>

        <section>
          <h2>4. User Conduct and Prohibited Activities</h2>
          <p>You agree to use the Service in a lawful and respectful manner. You may NOT:</p>
          <ul>
            <li><strong>Cheat or Exploit:</strong> Use hacks, bots, scripts, or any automated tools to gain unfair advantages or manipulate game scores.</li>
            <li><strong>Abuse the System:</strong> Submit false scores, spam the leaderboard, or interfere with other users' gameplay.</li>
            <li><strong>Offensive Content:</strong> Use offensive, abusive, discriminatory, or inappropriate names or messages.</li>
            <li><strong>Reverse Engineer:</strong> Decompile, disassemble, or reverse engineer any part of the Service.</li>
            <li><strong>Interfere with Service:</strong> Disrupt, damage, or overload our servers or networks.</li>
            <li><strong>Unauthorized Access:</strong> Attempt to gain unauthorized access to any part of the Service or other users' accounts.</li>
            <li><strong>Commercial Use:</strong> Use the Service for commercial purposes without our written permission.</li>
            <li><strong>Data Scraping:</strong> Use automated systems to extract data from the Service.</li>
          </ul>
          <p>
            Violation of these rules may result in immediate suspension or termination of your access to the Service, 
            removal of your scores from leaderboards, and potential legal action.
          </p>
        </section>

        <section>
          <h2>5. Intellectual Property Rights</h2>
          
          <h3>5.1 Our Rights</h3>
          <p>
            All content, features, and functionality of the Service, including but not limited to game design, 
            code, graphics, user interface, audio, and text, are owned by SlideMino and protected by international 
            copyright, trademark, and other intellectual property laws.
          </p>

          <h3>5.2 Limited License</h3>
          <p>
            We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the 
            Service for personal, non-commercial entertainment purposes. This license does not include the right to:
          </p>
          <ul>
            <li>Reproduce, distribute, or create derivative works from the Service</li>
            <li>Use the Service or its content for commercial purposes</li>
            <li>Remove or modify any copyright, trademark, or other proprietary notices</li>
          </ul>

          <h3>5.3 User-Generated Content</h3>
          <p>
            By submitting content (such as nicknames or scores) to the Service, you grant us a worldwide, 
            non-exclusive, royalty-free license to use, display, and distribute that content in connection 
            with the Service.
          </p>
        </section>

        <section>
          <h2>6. Privacy and Data</h2>
          <p>
            Your use of the Service is also governed by our <a href="#/privacy">Privacy Policy</a>, which 
            describes how we collect, use, and protect your information. By using the Service, you consent 
            to our privacy practices as described in the Privacy Policy.
          </p>
          <p>
            Key points include:
          </p>
          <ul>
            <li>Game progress is saved locally on your device</li>
            <li>Leaderboard submissions require a nickname (no email required)</li>
            <li>We use Google AdSense (web) and/or Google AdMob (native app) to display advertisements</li>
            <li>Cookies and local storage are used to enhance your experience</li>
          </ul>
        </section>

        <section>
          <h2>7. Advertising</h2>
          <p>
            The Service may display third-party advertisements through Google AdSense (web) and/or Google AdMob (native app).
            We do not control the content of these advertisements. By using the Service, you acknowledge and agree that:
          </p>
          <ul>
            <li>Advertisements are provided by third parties and subject to their terms</li>
            <li>We are not responsible for the accuracy or legality of advertised content</li>
            <li>Clicking on advertisements may redirect you to third-party websites</li>
            <li>Third-party advertisers may collect data about your browsing activities</li>
          </ul>
        </section>

        <section>
          <h2>8. Disclaimers and Warranties</h2>
          
          <h3>8.1 "AS IS" Service</h3>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND, 
            EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, 
            INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul>
            <li>Warranties of merchantability, fitness for a particular purpose, and non-infringement</li>
            <li>Warranties that the Service will be uninterrupted, error-free, or secure</li>
            <li>Warranties regarding the accuracy, reliability, or completeness of content</li>
          </ul>

          <h3>8.2 No Guarantee</h3>
          <p>
            We do not guarantee that:
          </p>
          <ul>
            <li>The Service will meet your specific requirements or expectations</li>
            <li>Your game progress will be permanently saved or recoverable</li>
            <li>Leaderboard rankings will remain unchanged or uncorrupted</li>
            <li>The Service will be compatible with all devices or browsers</li>
          </ul>
        </section>

        <section>
          <h2>9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL SLIDEMINO, ITS AFFILIATES, OFFICERS, 
            DIRECTORS, EMPLOYEES, OR PARTNERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, 
            OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul>
            <li>Loss of data, profits, or revenue</li>
            <li>Loss of use or enjoyment of the Service</li>
            <li>Business interruption or lost business opportunities</li>
            <li>Damage to reputation or goodwill</li>
          </ul>
          <p>
            ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE SERVICE, WHETHER BASED ON 
            WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN 
            ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p>
            IN JURISDICTIONS THAT DO NOT ALLOW THE EXCLUSION OR LIMITATION OF LIABILITY FOR CONSEQUENTIAL OR 
            INCIDENTAL DAMAGES, OUR LIABILITY IS LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          </p>
        </section>

        <section>
          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless SlideMino and its affiliates, officers, directors, 
            employees, and partners from and against any claims, liabilities, damages, losses, and expenses, 
            including reasonable legal fees, arising out of or in any way connected with:
          </p>
          <ul>
            <li>Your access to or use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights, including intellectual property rights</li>
            <li>Any content you submit or transmit through the Service</li>
          </ul>
        </section>

        <section>
          <h2>11. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to the Service at any time, with or 
            without cause, with or without notice, for any reason including but not limited to:
          </p>
          <ul>
            <li>Violation of these Terms or our policies</li>
            <li>Fraudulent, abusive, or illegal activity</li>
            <li>Prolonged inactivity</li>
            <li>Technical or security reasons</li>
          </ul>
          <p>
            Upon termination:
          </p>
          <ul>
            <li>Your right to use the Service immediately ceases</li>
            <li>Your scores may be removed from leaderboards</li>
            <li>Your locally saved game data remains on your device but may not be accessible</li>
          </ul>
          <p>
            Provisions of these Terms that by their nature should survive termination shall survive, including 
            but not limited to disclaimers, limitations of liability, and indemnification.
          </p>
        </section>

        <section>
          <h2>12. Changes to the Service and Terms</h2>
          <p>
            We reserve the right to:
          </p>
          <ul>
            <li>Modify, update, or discontinue any aspect of the Service at any time</li>
            <li>Change these Terms at any time by posting updated Terms on this page</li>
            <li>Implement new features that may be subject to additional terms</li>
          </ul>
          <p>
            Material changes will be effective upon posting. Your continued use of the Service after changes 
            constitutes acceptance of the modified Terms. We encourage you to review these Terms periodically.
          </p>
        </section>

        <section>
          <h2>13. Dispute Resolution and Governing Law</h2>
          
          <h3>13.1 Governing Law</h3>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], 
            without regard to its conflict of law provisions.
          </p>

          <h3>13.2 Arbitration</h3>
          <p>
            Any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall 
            be resolved through binding arbitration rather than in court, except that you may assert claims in 
            small claims court if your claims qualify.
          </p>

          <h3>13.3 Class Action Waiver</h3>
          <p>
            YOU AND SLIDEMINO AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL 
            CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.
          </p>
        </section>

        <section>
          <h2>14. Miscellaneous</h2>
          
          <h3>14.1 Entire Agreement</h3>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and 
            SlideMino regarding the Service and supersede all prior agreements and understandings.
          </p>

          <h3>14.2 Severability</h3>
          <p>
            If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions 
            shall remain in full force and effect.
          </p>

          <h3>14.3 Waiver</h3>
          <p>
            Our failure to enforce any right or provision of these Terms shall not be deemed a waiver of such 
            right or provision.
          </p>

          <h3>14.4 Assignment</h3>
          <p>
            You may not assign or transfer these Terms or your rights hereunder without our prior written consent. 
            We may assign these Terms without restriction.
          </p>

          <h3>14.5 Force Majeure</h3>
          <p>
            We shall not be liable for any failure to perform our obligations due to circumstances beyond our 
            reasonable control, including acts of God, war, terrorism, riots, natural disasters, or internet 
            service failures.
          </p>
        </section>

        <section>
          <h2>15. Contact Information</h2>
          <p>
            If you have any questions, concerns, or feedback regarding these Terms or the Service, please 
            contact us:
          </p>
          <ul>
            <li><strong>Email:</strong> studio@emozleep.space</li>
            <li><strong>Website:</strong> <a href="https://www.slidemino.emozleep.space/#/contact">Contact Page</a></li>
          </ul>
          <p>We will respond to all inquiries within 5-7 business days.</p>
        </section>

        <section className="acknowledgment">
          <h2>16. Acknowledgment</h2>
          <p>
            BY USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY 
            THESE TERMS OF SERVICE. IF YOU DO NOT AGREE, PLEASE DO NOT USE THE SERVICE.
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

export default withBackNavigation(Terms);
