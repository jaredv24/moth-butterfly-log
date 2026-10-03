import SwiftUI
import UserNotifications

/// Native push for chat messages: asks permission, registers this iPhone with the
/// server (/api/apns), keeps the app badge in sync, and opens the chat on tap.
@MainActor
final class PushManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushManager()
    weak var model: AppModel?

    private let tokenKey = "lep.apnsToken"
    var token: String? { UserDefaults.standard.string(forKey: tokenKey) }

    /// Development builds talk to Apple's sandbox; TestFlight and the App Store to production.
    private var environment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    func configure(model: AppModel) {
        self.model = model
        UNUserNotificationCenter.current().delegate = self
    }

    func status() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Re-registers on launch so the server always has this phone's current token.
    func registerIfAuthorized() async {
        if await status() == .authorized { UIApplication.shared.registerForRemoteNotifications() }
    }

    @discardableResult
    func requestPermission() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: tokenKey)
        Task { await save() }
    }

    private func save() async {
        guard let token, let model, let code = model.code else { return }
        let _: API.Empty? = try? await model.api.send("/api/apns", body: ["code": code, "token": token, "environment": environment])
    }

    /// Turning notifications off, or switching to another log: this phone stops getting that log's messages.
    func unregister() async {
        guard let token, let model, let code = model.code else { return }
        let _: API.Empty? = try? await model.api.send("/api/apns", method: "DELETE", body: ["code": code, "token": token])
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    // MARK: UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification)
        async -> UNNotificationPresentationOptions {
        let url = notification.request.content.userInfo["url"] as? String
        return await MainActor.run {
            Task { await self.model?.refreshUnread() }
            // Already looking at that conversation: the message just appears there.
            if let url, let open = model?.openChatUserId, url == "/chat/\(open)" { return [] }
            return [.banner, .list, .sound]
        }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let url = response.notification.request.content.userInfo["url"] as? String
        await MainActor.run {
            if let url { model?.handle(path: url) }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushManager.shared.didRegister(deviceToken: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[leplog] push registration failed:", error.localizedDescription)
    }
}
