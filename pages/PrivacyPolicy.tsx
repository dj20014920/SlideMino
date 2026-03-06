import React from 'react';
import { Home } from 'lucide-react';
import { withBackNavigation } from '../components/PageWithBackNavigation';

/**
 * 개인정보 처리방침 페이지
 * Google Play / App Store 정책 요구사항 충족 및 사용자 정보 보호 명시
 * COPPA, GDPR, CCPA 등 국제 개인정보 보호 규정 준수
 */
const PrivacyPolicy: React.FC = () => {
  return (
    <div className="policy-page">
      <header className="policy-header">
        <h1>Privacy Policy</h1>
        <p className="tagline">개인정보 처리방침</p>
        <p className="last-updated">Last Updated: March 6, 2026 | 최종 수정일: 2026년 3월 6일</p>
      </header>

      <div className="policy-content">
        {/* 1. 소개 */}
        <section>
          <h2>1. Introduction / 소개</h2>
          <p>
            Welcome to 블록 슬라이드 (Block Slide) (hereinafter "the App," "the Game," "we," "us," or "our"),
            developed and operated by Emozleep Studio. We are committed to protecting your privacy and ensuring
            transparency about how we collect, use, and protect your information. This Privacy Policy explains
            our practices regarding data collection and usage for both the web version and native mobile apps
            (iOS/Android).
          </p>
          <p>
            블록 슬라이드 (Block Slide)에 오신 것을 환영합니다. 본 앱은 Emozleep Studio에서 개발 및 운영하며,
            사용자의 개인정보 보호에 최선을 다하고 있습니다. 본 개인정보 처리방침은 웹 버전 및 네이티브 모바일 앱
            (iOS/Android)에서 정보를 수집, 사용, 보호하는 방식에 대해 투명하게 설명합니다.
          </p>
        </section>

        {/* 2. 개발자 정보 */}
        <section>
          <h2>2. Developer Information / 개발자 정보</h2>
          <ul>
            <li><strong>Developer / 개발자:</strong> Emozleep Studio</li>
            <li><strong>Email / 이메일:</strong> studio@emozleep.space</li>
            <li><strong>Website / 웹사이트:</strong>{' '}
              <a href="https://slidemino.emozleep.space" target="_blank" rel="noopener noreferrer">
                https://slidemino.emozleep.space
              </a>
            </li>
          </ul>
        </section>

        {/* 3. 수집하는 정보 */}
        <section>
          <h2>3. Information We Collect / 수집하는 정보</h2>

          <h3>3.1 Information You Provide / 사용자가 제공하는 정보</h3>
          <ul>
            <li>
              <strong>Player Name (닉네임):</strong> You may provide a nickname when playing the game to appear
              on leaderboards. This name is voluntarily provided and publicly visible on leaderboard rankings.
              <br />리더보드에 표시할 닉네임을 자발적으로 입력할 수 있습니다. 이 이름은 리더보드 순위에 공개적으로 표시됩니다.
            </li>
            <li>
              <strong>Contact Information (연락처):</strong> Email addresses only if you contact us for support or feedback.
              <br />고객 지원 또는 피드백을 위해 연락하는 경우에만 이메일 주소를 수집합니다.
            </li>
          </ul>

          <h3>3.2 Automatically Collected Information / 자동으로 수집되는 정보</h3>
          <ul>
            <li>
              <strong>Game Data (게임 데이터):</strong> High scores, game progress, settings, streak data,
              mission progress, and skin customization preferences stored locally on your device using
              browser local storage or app storage.
              <br />최고 점수, 게임 진행 상황, 설정, 연속 출석 기록, 미션 진행 상황, 스킨 커스터마이징 환경설정은
              브라우저 로컬 스토리지 또는 앱 저장소를 통해 기기에 로컬로 저장됩니다.
            </li>
            <li>
              <strong>Analytics Identifiers (분석 식별자):</strong> A random app install identifier
              (UUID-format, e.g., <code>crypto.randomUUID()</code>) and a session identifier are generated
              for analytics purposes. Install identifiers are hashed using salted SHA-256 before being
              stored on our servers. These identifiers do not contain any personal information and cannot
              be used to identify you personally.
              <br />분석 목적으로 무작위 앱 설치 식별자(UUID 형식)와 세션 식별자가 생성됩니다.
              설치 식별자는 서버에 저장되기 전에 솔트된 SHA-256 해싱 처리됩니다.
              이 식별자에는 개인 정보가 포함되지 않으며 개인을 식별하는 데 사용될 수 없습니다.
            </li>
            <li>
              <strong>Usage Data (사용 데이터):</strong> Aggregated event data such as app launch, session
              start/end, game start/end counts, session duration (heartbeat signals at 3-minute intervals),
              and ad feature usage for improving user experience. We do <strong>not</strong> track individual
              gameplay actions or movement patterns.
              <br />앱 실행, 세션 시작/종료, 게임 시작/종료 횟수, 세션 지속 시간(3분 간격 하트비트 신호), 광고 기능
              사용량 등 집계된 이벤트 데이터를 수집합니다. 개별 게임플레이 동작이나 이동 패턴은 추적하지 않습니다.
            </li>
            <li>
              <strong>Technical Data (기술 데이터):</strong> Platform category (web/iOS/Android), broad device
              group (e.g., iPhone, Galaxy, Web, Tablet, Desktop), browser language setting
              (<code>navigator.language</code>), app version, and security logs. We do <strong>not</strong>{' '}
              collect precise device model numbers, IMEI, hardware serial numbers, or IP addresses for
              analytics purposes.
              <br />플랫폼 유형(웹/iOS/Android), 기기 그룹(iPhone, Galaxy, Web, Tablet, Desktop 등),
              브라우저 언어 설정, 앱 버전, 보안 로그를 수집합니다. 정확한 기기 모델 번호, IMEI, 하드웨어 일련번호,
              IP 주소는 분석 목적으로 수집하지 않습니다.
            </li>
            <li>
              <strong>Leaderboard Data (리더보드 데이터):</strong> When you submit a score to the leaderboard,
              we collect your nickname, score, game difficulty, game duration, number of moves, platform,
              and hashed install ID. This data is stored on our servers.
              <br />리더보드에 점수를 제출하면 닉네임, 점수, 게임 난이도, 게임 소요 시간, 이동 횟수, 플랫폼,
              해싱된 설치 ID를 수집합니다. 이 데이터는 서버에 저장됩니다.
            </li>
          </ul>

          <h3>3.3 Information We Do NOT Collect / 수집하지 않는 정보</h3>
          <ul>
            <li>Real name, date of birth, or age / 실명, 생년월일 또는 나이</li>
            <li>Phone number or physical address / 전화번호 또는 물리적 주소</li>
            <li>Photos, contacts, or files from your device / 기기의 사진, 연락처 또는 파일</li>
            <li>Precise location or GPS data / 정밀 위치 또는 GPS 데이터</li>
            <li>Financial or payment information / 재무 또는 결제 정보</li>
            <li>SMS, call logs, or microphone/camera data / SMS, 통화 기록 또는 마이크/카메라 데이터</li>
            <li>Health, fitness, or biometric data / 건강, 피트니스 또는 생체 데이터</li>
          </ul>

          <h3>3.4 Cookies and Similar Technologies / 쿠키 및 유사 기술</h3>
          <p>
            We use browser local storage and session storage to save your game progress, preferences,
            and provide personalized experiences. On the web version, we present a cookie consent banner
            before loading any advertising-related cookies. You can control cookies through your browser
            settings. You may also revoke your cookie consent at any time through the app's settings.
          </p>
          <p>
            브라우저 로컬 스토리지와 세션 스토리지를 사용하여 게임 진행 상황, 환경설정을 저장하고 개인화된 경험을
            제공합니다. 웹 버전에서는 광고 관련 쿠키를 로드하기 전에 쿠키 동의 배너를 표시합니다. 브라우저 설정을
            통해 쿠키를 제어할 수 있으며, 앱 설정을 통해 언제든지 쿠키 동의를 철회할 수 있습니다.
          </p>
        </section>

        {/* 4. 광고 */}
        <section>
          <h2>4. Advertising / 광고</h2>
          <p>
            블록 슬라이드 (Block Slide) displays advertisements to support the free service.
          </p>
          <ul>
            <li><strong>Web version (웹 버전):</strong> Google AdSense</li>
            <li><strong>Mobile app (모바일 앱):</strong> Google AdMob</li>
          </ul>
          <p>
            Depending on your consent choices and platform capabilities, ads may be personalized or
            non-personalized.
          </p>

          <h3>4.1 Types of Ads / 광고 유형</h3>
          <ul>
            <li><strong>Banner Ads (배너 광고):</strong> Displayed at the bottom of the game screen.</li>
            <li><strong>Rewarded Ads (보상형 광고):</strong> Optionally viewed by the user to receive in-game
              rewards such as undo, block refresh, game revival, or cosmetic skin draws. These ads are
              never forced and always require user opt-in.
              <br />되돌리기, 블록 새로고침, 게임 부활, 스킨 뽑기 등 게임 내 보상을 받기 위해 사용자가 선택적으로
              시청합니다. 이러한 광고는 강제되지 않으며 항상 사용자의 동의가 필요합니다.
            </li>
            <li><strong>Rewarded Interstitial Ads (보상형 전면 광고):</strong> May appear between game sessions
              with user opt-in for additional rewards.</li>
          </ul>

          <h3>4.2 Third-Party Advertising / 제3자 광고</h3>
          <ul>
            <li>Google's use of advertising cookies enables it and its partners to serve ads based on your
              visits to this site and/or other sites on the Internet.</li>
            <li>You may opt out of personalized advertising by visiting{' '}
              <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">
                Google Ads Settings
              </a>.
            </li>
            <li>You can also visit{' '}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">
                aboutads.info
              </a>{' '}
              to opt out of third-party vendors' use of cookies for personalized advertising.
            </li>
          </ul>

          <h3>4.3 AdSense / AdMob Partner Information / 광고 파트너 정보</h3>
          <p>
            Google advertising products (such as AdSense and AdMob) may use cookies and/or device
            identifiers to provide and measure ads. For more information about Google's privacy
            practices, please visit the{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google Privacy Policy
            </a>.
          </p>
        </section>

        {/* 5. 정보 사용 방법 */}
        <section>
          <h2>5. How We Use Your Information / 정보 사용 방법</h2>
          <ul>
            <li><strong>Game Functionality (게임 기능):</strong> To save your progress, maintain leaderboards,
              track streaks and missions, and provide core game features.</li>
            <li><strong>Improvement (개선):</strong> To analyze aggregated usage patterns and improve game
              design, feature prioritization, and performance.</li>
            <li><strong>Communication (커뮤니케이션):</strong> To respond to your inquiries and provide customer
              support.</li>
            <li><strong>Security (보안):</strong> To detect and prevent fraud, cheating, abuse, or technical
              issues (e.g., anti-cheat score verification).</li>
            <li><strong>Advertising (광고):</strong> To display relevant ads through Google AdSense (web)
              and/or Google AdMob (native app).</li>
            <li><strong>Local Notifications (로컬 알림, 모바일 앱 전용):</strong> On native mobile apps (iOS/Android),
              we may schedule local push notifications to remind you about daily streaks and missions.
              Notifications are processed entirely on your device and are never sent to external servers.
              You can disable notifications at any time through the app's settings or your device settings.
              <br />네이티브 모바일 앱(iOS/Android)에서 일일 출석 및 미션 알림을 위한 로컬 푸시 알림을 예약할 수 있습니다.
              알림은 완전히 기기에서 처리되며 외부 서버로 전송되지 않습니다. 앱 설정 또는 기기 설정을 통해 언제든지
              알림을 비활성화할 수 있습니다.
            </li>
          </ul>
        </section>

        {/* 6. 데이터 저장 및 보안 */}
        <section>
          <h2>6. Data Storage and Security / 데이터 저장 및 보안</h2>
          <p>
            Your game data is primarily stored locally on your device using browser local storage or app
            storage. Leaderboard data and analytics events are stored securely on our servers (Cloudflare
            Workers with D1 database) with appropriate security measures including:
          </p>
          <ul>
            <li>Encryption of data in transit using HTTPS/TLS</li>
            <li>Install identifiers are hashed (salted SHA-256) before server-side storage</li>
            <li>Access controls and authentication for server data</li>
            <li>Admin-only analytics access with short-lived authentication tokens</li>
            <li>Rate limiting and request validation for all APIs</li>
            <li>Anti-cheat mechanisms including score verification and duration validation</li>
            <li>Regular security audits and updates</li>
          </ul>
          <p>
            However, no method of transmission over the Internet is 100% secure. While we strive to protect
            your information, we cannot guarantee absolute security.
          </p>
        </section>

        {/* 7. 데이터 보관 기간 */}
        <section>
          <h2>7. Data Retention / 데이터 보관 기간</h2>
          <p>We retain your data for the following periods / 다음 기간 동안 데이터를 보관합니다:</p>
          <ul>
            <li>
              <strong>Local game data (로컬 게임 데이터):</strong> Retained on your device until you clear
              browser/app storage or uninstall the app. We do not have access to this data.
              <br />브라우저/앱 저장소를 삭제하거나 앱을 제거할 때까지 기기에 보관됩니다. 당사는 이 데이터에 접근할 수 없습니다.
            </li>
            <li>
              <strong>Leaderboard data (리더보드 데이터):</strong> Retained for the duration of the current
              season (typically 90 days). Historical season data may be archived.
              <br />현재 시즌 동안 보관됩니다(일반적으로 90일). 과거 시즌 데이터는 보관될 수 있습니다.
            </li>
            <li>
              <strong>Analytics data (분석 데이터):</strong> Aggregated analytics events are retained for up
              to 12 months for service improvement, then deleted or permanently anonymized.
              <br />집계된 분석 이벤트는 서비스 개선을 위해 최대 12개월 동안 보관된 후 삭제되거나 영구적으로 익명화됩니다.
            </li>
            <li>
              <strong>Support communications (고객 지원 기록):</strong> Retained for up to 24 months after
              the issue is resolved.
              <br />문제 해결 후 최대 24개월 동안 보관됩니다.
            </li>
          </ul>
        </section>

        {/* 8. 데이터 공유 및 공개 */}
        <section>
          <h2>8. Data Sharing and Disclosure / 데이터 공유 및 공개</h2>
          <p>
            We do <strong>not</strong> sell, trade, or rent your personal information. We may share data
            only in the following circumstances:
          </p>
          <ul>
            <li><strong>With Your Consent (동의 시):</strong> When you explicitly agree to share information
              (e.g., posting scores to the public leaderboard).</li>
            <li><strong>Service Providers (서비스 제공자):</strong> With trusted partners who help operate our
              service:
              <ul>
                <li>Google AdSense / Google AdMob — For serving advertisements</li>
                <li>Cloudflare — For hosting, CDN, and web analytics (Cloudflare Web Analytics)</li>
              </ul>
            </li>
            <li><strong>Legal Requirements (법적 요구사항):</strong> When required by law, regulation, legal
              process, or governmental request.</li>
            <li><strong>Business Transfers (사업 양도):</strong> In connection with a merger, acquisition,
              or sale of assets, with prior notice to affected users.</li>
          </ul>
          <p>
            We do <strong>not</strong> share any data with data brokers or third-party marketing companies.
            <br />데이터 브로커 또는 제3자 마케팅 회사와 데이터를 공유하지 않습니다.
          </p>
        </section>

        {/* 9. 사용자 권리 */}
        <section>
          <h2>9. Your Rights and Choices / 사용자 권리 및 선택</h2>
          <p>You have the following rights regarding your information / 귀하의 정보에 대해 다음과 같은 권리가 있습니다:</p>
          <ul>
            <li><strong>Access (접근):</strong> Request a copy of your data stored on our servers.
              <br />서버에 저장된 데이터의 사본을 요청할 수 있습니다.</li>
            <li><strong>Deletion (삭제):</strong> Clear your local game data at any time through browser/app
              settings. Request deletion of server-side data by contacting us at studio@emozleep.space.
              We will process deletion requests within 30 days.
              <br />브라우저/앱 설정을 통해 언제든지 로컬 게임 데이터를 삭제할 수 있습니다. 서버 측 데이터 삭제는
              studio@emozleep.space로 연락하여 요청할 수 있으며, 30일 이내에 처리됩니다.</li>
            <li><strong>Correction (정정):</strong> Update or correct your information by contacting us.
              <br />당사에 연락하여 정보를 업데이트하거나 수정할 수 있습니다.</li>
            <li><strong>Opt-Out of Personalized Ads (맞춤 광고 거부):</strong> Disable cookies through browser
              settings or opt out of personalized ads through{' '}
              <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">
                Google Ads Settings
              </a>.
              <br />브라우저 설정을 통해 쿠키를 비활성화하거나 Google 광고 설정을 통해 맞춤 광고를 거부할 수 있습니다.</li>
            <li><strong>Notification Control (알림 제어):</strong> Disable local push notifications through the
              app's settings menu or your device's notification settings.
              <br />앱 설정 메뉴 또는 기기의 알림 설정을 통해 로컬 푸시 알림을 비활성화할 수 있습니다.</li>
            <li><strong>Data Portability (데이터 이동):</strong> Request your data in a portable format.
              <br />이동 가능한 형식으로 데이터를 요청할 수 있습니다.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at <strong>studio@emozleep.space</strong>. We will
            respond to all requests within 30 days.
            <br />이러한 권리를 행사하려면 <strong>studio@emozleep.space</strong>로 연락해 주세요. 모든 요청에 30일 이내에 응답합니다.
          </p>
        </section>

        {/* 10. 아동 개인정보 보호 */}
        <section>
          <h2>10. Age Requirement & Children’s Privacy / 연령 제한 및 아동 개인정보 보호</h2>
          <p>
            블록 슬라이드 (Block Slide) is a puzzle game intended for users aged 13 and older.
            This app is <strong>not directed at children under 13</strong> and does not knowingly
            collect personal information from children under 13 years of age.
          </p>
          <p>
            블록 슬라이드는 만 13세 이상의 이용자를 대상으로 하는 퍼즐 게임입니다.
            본 앱은 <strong>만 13세 미만 아동을 대상으로 하지 않으며</strong>, 만 13세 미만 아동의
            개인정보를 의도적으로 수집하지 않습니다.
          </p>

          <h3>10.1 Age Restriction / 연령 제한</h3>
          <ul>
            <li>This app requires users to be at least 13 years of age to use the Service, as stated in
              our <a href="#/terms">Terms of Service</a>.
              <br />본 앱은 이용약관에 명시된 바와 같이 만 13세 이상의 이용자만 사용할 수 있습니다.</li>
            <li>We do <strong>not</strong> knowingly collect personal information from children under 13 years
              of age (or the applicable age in your jurisdiction). If we discover that a child under 13 has
              provided us with personal information, we will promptly delete it.
              <br />만 13세 미만 아동(또는 해당 관할권의 적용 연령 미만)의 개인 정보를 의도적으로 수집하지 않습니다.
              만 13세 미만 아동이 개인정보를 제공한 사실을 발견하면 즉시 삭제합니다.</li>
            <li>We do <strong>not</strong> require or request age verification or any personal identification
              from users.
              <br />사용자에게 나이 확인 또는 개인 식별 정보를 요구하거나 요청하지 않습니다.</li>
          </ul>

          <h3>10.2 Advertising / 광고</h3>
          <p>
            Since this app is not directed at children under 13, standard advertising practices apply.
            All ads comply with Google AdSense and Google AdMob policies. Rewarded ads are opt-in only
            and are never forced on any user.
          </p>
          <p>
            본 앱은 만 13세 미만 아동을 대상으로 하지 않으므로 표준 광고 정책이 적용됩니다.
            모든 광고는 Google AdSense 및 Google AdMob 정책을 준수합니다. 보상형 광고는 선택 사항이며
            어떤 사용자에게도 강제되지 않습니다.
          </p>

          <h3>10.3 Contact Regarding Minors / 미성년자 관련 문의</h3>
          <p>
            If you are a parent or guardian and believe that a child under 13 has used this app or
            provided personal information to us in any way, please contact us immediately at{' '}
            <strong>studio@emozleep.space</strong>. We will:
          </p>
          <ul>
            <li>Promptly investigate the claim / 신고를 즉시 조사합니다</li>
            <li>Delete any identified personal information within 48 hours /
              확인된 개인 정보를 48시간 이내에 삭제합니다</li>
            <li>Take reasonable steps to prevent future unauthorized access /
              향후 무단 접근을 방지하기 위한 합리적인 조치를 취합니다</li>
          </ul>
        </section>

        {/* 11. 권한 */}
        <section>
          <h2>11. App Permissions / 앱 권한</h2>
          <p>
            블록 슬라이드 (Block Slide) requests the minimum permissions necessary:
            <br />블록 슬라이드는 필요한 최소한의 권한만 요청합니다:
          </p>
          <ul>
            <li>
              <strong>INTERNET (인터넷):</strong> Required for leaderboard functionality, ad serving,
              analytics, and weekly/daily challenge features.
              <br />리더보드 기능, 광고 제공, 분석, 주간/일일 챌린지 기능에 필요합니다.
            </li>
            <li>
              <strong>Local Notifications (로컬 알림, iOS/Android만 해당):</strong> Optional permission
              requested for streak and mission reminder notifications. You can deny or revoke this
              permission at any time. If denied, the app continues to function normally without notifications.
              <br />연속 출석 및 미션 알림을 위해 요청되는 선택적 권한입니다. 언제든지 거부하거나 철회할 수 있습니다.
              거부해도 앱은 알림 없이 정상적으로 작동합니다.
            </li>
          </ul>
          <p>
            We do <strong>not</strong> request access to contacts, camera, microphone, location, storage,
            phone state, SMS, or call logs.
            <br />연락처, 카메라, 마이크, 위치, 저장소, 전화 상태, SMS 또는 통화 기록에 대한 접근을 요청하지 않습니다.
          </p>
        </section>

        {/* 12. 국제 사용자 및 데이터 이전 */}
        <section>
          <h2>12. International Users and Data Transfers / 국제 사용자 및 데이터 이전</h2>
          <p>
            블록 슬라이드 (Block Slide) is hosted on Cloudflare's global edge network. Your information may
            be transferred to and processed in countries other than your own.
          </p>

          <h3>12.1 For Users in the European Economic Area (EEA) / GDPR</h3>
          <p>
            If you are located in the EEA, we process your data based on the following legal bases under
            the General Data Protection Regulation (GDPR):
          </p>
          <ul>
            <li><strong>Consent:</strong> For personalized advertising and optional cookie usage. You can
              withdraw consent at any time.</li>
            <li><strong>Legitimate Interest:</strong> For analytics and service improvement, fraud prevention,
              and security.</li>
            <li><strong>Contract Performance:</strong> For providing core game functionality including
              leaderboard services.</li>
          </ul>
          <p>
            You have the right to lodge a complaint with your local Data Protection Authority.
          </p>

          <h3>12.2 For Users in California (CCPA / CPRA)</h3>
          <p>
            California residents have additional rights under the California Consumer Privacy Act (CCPA)
            and the California Privacy Rights Act (CPRA):
          </p>
          <ul>
            <li>Right to know what personal information is collected and how it is used</li>
            <li>Right to delete personal information</li>
            <li>Right to opt-out of the "sale" or "sharing" of personal information — <strong>We do not
              sell your personal information</strong></li>
            <li>Right to non-discrimination for exercising your privacy rights</li>
          </ul>
          <p>
            To exercise these rights, contact us at <strong>studio@emozleep.space</strong>.
          </p>

          <h3>12.3 For Users in South Korea / 대한민국 사용자</h3>
          <p>
            대한민국 「개인정보 보호법」에 따라, 당사는 다음 사항을 보장합니다:
          </p>
          <ul>
            <li>개인정보의 수집 및 이용 목적을 명확히 고지합니다.</li>
            <li>수집하는 개인정보의 항목을 최소화합니다.</li>
            <li>개인정보의 보유 및 이용 기간을 준수합니다.</li>
            <li>이용자는 언제든지 개인정보의 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.</li>
            <li>개인정보 관련 문의: studio@emozleep.space</li>
          </ul>
        </section>

        {/* 13. 제3자 서비스 */}
        <section>
          <h2>13. Third-Party Services / 제3자 서비스</h2>
          <p>
            블록 슬라이드 (Block Slide) uses the following third-party services:
            <br />블록 슬라이드는 다음 제3자 서비스를 사용합니다:
          </p>
          <ul>
            <li>
              <strong>Google AdSense / AdMob:</strong> For advertising.{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </li>
            <li>
              <strong>Cloudflare:</strong> For hosting, CDN, and web analytics.{' '}
              <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </li>
            <li>
              <strong>Google Fonts:</strong> For typography (Inter font family).{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </li>
          </ul>
          <p>
            These services may collect data independently according to their own privacy policies. We
            encourage you to review their privacy policies. We are not responsible for the privacy
            practices of these external services.
            <br />이러한 서비스는 자체 개인정보 보호정책에 따라 독립적으로 데이터를 수집할 수 있습니다. 해당 서비스의
            개인정보 보호정책을 검토하시기 바랍니다. 당사는 이러한 외부 서비스의 개인정보 보호 관행에 대해
            책임지지 않습니다.
          </p>
        </section>

        {/* 14. 정책 변경 */}
        <section>
          <h2>14. Changes to This Policy / 정책 변경</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make significant changes, we will:
          </p>
          <ul>
            <li>Update the "Last Updated" date at the top of this page</li>
            <li>Post notice of the changes within the App</li>
            <li>Provide at least 7 days advance notice for material changes</li>
          </ul>
          <p>
            Your continued use of 블록 슬라이드 (Block Slide) after changes constitutes acceptance of the
            updated policy. We encourage you to periodically review this page.
          </p>
          <p>
            본 개인정보 처리방침은 수시로 업데이트될 수 있습니다. 중요한 변경이 있을 경우, 페이지 상단의
            "최종 수정일"을 업데이트하고, 앱 내에 변경 사항을 공지하며, 중대한 변경의 경우 최소 7일 전에
            사전 공지합니다. 변경 후에도 블록 슬라이드를 계속 사용하면 업데이트된 정책에 동의한 것으로 간주됩니다.
          </p>
        </section>

        {/* 15. 연락처 */}
        <section>
          <h2>15. Contact Us / 연락처</h2>
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy, your personal
            information, or to exercise any of your rights, please contact us:
          </p>
          <p>
            본 개인정보 처리방침, 귀하의 개인정보, 또는 권리 행사에 관한 질문, 우려 또는 요청이 있으시면
            다음으로 연락해 주세요:
          </p>
          <ul>
            <li><strong>Developer / 개발자:</strong> Emozleep Studio</li>
            <li><strong>Email / 이메일:</strong> studio@emozleep.space</li>
            <li><strong>Website / 웹사이트:</strong>{' '}
              <a href="https://slidemino.emozleep.space/#/contact">Contact Page</a></li>
          </ul>
          <p>
            We will respond to all requests within <strong>30 days</strong>.
            <br />모든 요청에 <strong>30일 이내</strong>에 응답합니다.
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

export default withBackNavigation(PrivacyPolicy);
