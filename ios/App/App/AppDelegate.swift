import UIKit
import Capacitor
import AdSupport
import AppTrackingTransparency

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // TODO: IDFA 확인 후 AdMob 콘솔 등록 완료되면 아래 블록 삭제
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            let idfa = ASIdentifierManager.shared().advertisingIdentifier.uuidString
            print("========================================")
            print("📱 IDFA (AdMob 콘솔 등록용): \(idfa)")
            print("========================================")
        }
        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Called when a new scene session is being created.
        // Use this method to select a configuration to create the new scene with.
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // Called when the user discards a scene session.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        // 앱 동작은 세로 고정으로 유지한다.
        return .portrait
    }

}

@objc(StoreInstallPlugin)
class StoreInstallPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "StoreInstallPlugin"
    let jsName = "StoreInstall"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getInstallInfo", returnType: CAPPluginReturnPromise)
    ]

    @objc func getInstallInfo(_ call: CAPPluginCall) {
        #if targetEnvironment(simulator)
        call.resolve([
            "platform": "ios",
            "isStoreInstall": false,
            "channel": "simulator",
            "installerPackage": NSNull(),
            "initiatingPackage": NSNull(),
            "packageSource": -1,
            "receiptFileName": NSNull(),
            "hasSandboxReceipt": false,
            "hasEmbeddedProvision": false,
            "hasReceiptFile": false
        ])
        return
        #endif

        let receiptURL = Bundle.main.appStoreReceiptURL
        let receiptPath = receiptURL?.path ?? ""
        let receiptFileName = receiptURL?.lastPathComponent ?? ""
        let hasReceiptURL = receiptURL != nil
        let hasSandboxReceipt = receiptPath.contains("sandboxReceipt") || receiptFileName == "sandboxReceipt"
        let hasEmbeddedProvision = Bundle.main.path(forResource: "embedded", ofType: "mobileprovision") != nil
        let hasReceiptFile = !receiptPath.isEmpty && FileManager.default.fileExists(atPath: receiptPath)

        // App Store 배포본은 embedded.mobileprovision 이 없고 sandbox 영수증이 아니다.
        // 일부 기기/타이밍에서 영수증 파일 생성이 지연될 수 있어 receipt URL 존재도 함께 고려한다.
        let isLikelyStoreSigned = !hasEmbeddedProvision && !hasSandboxReceipt
        let isStoreInstall = isLikelyStoreSigned && (hasReceiptFile || hasReceiptURL)
        let channel: String

        if isStoreInstall {
            channel = "store"
        } else if hasSandboxReceipt {
            channel = "testflight_or_sandbox"
        } else if hasEmbeddedProvision {
            channel = "debug_signed"
        } else {
            channel = "unknown"
        }

        call.resolve([
            "platform": "ios",
            "isStoreInstall": isStoreInstall,
            "channel": channel,
            "installerPackage": NSNull(),
            "initiatingPackage": NSNull(),
            "packageSource": -1,
            "receiptFileName": receiptFileName,
            "hasSandboxReceipt": hasSandboxReceipt,
            "hasEmbeddedProvision": hasEmbeddedProvision,
            "hasReceiptFile": hasReceiptFile
        ])
    }
}

class MainBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(StoreInstallPlugin.self)
    }
}
