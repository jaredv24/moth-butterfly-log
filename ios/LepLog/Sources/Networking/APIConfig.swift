import Foundation

/// Where the app talks to the Lep Log backend (the Next.js app's `/api/*`
/// routes). Not a secret, so plain `UserDefaults` is fine here — the login
/// code itself lives in the Keychain (see `KeychainStore`).
final class APIConfig: ObservableObject {
    static let shared = APIConfig()

    private static let storageKey = "leplog.apiBaseURL"

    /// The iOS Simulator shares its host Mac's network stack, so this reaches
    /// `npm run dev` on the Mac with zero extra setup. Testing on a physical
    /// device needs the Mac's LAN IP instead (set it below, in Profile).
    static let defaultURLString = "http://localhost:3000"

    @Published var baseURLString: String {
        didSet { UserDefaults.standard.set(baseURLString, forKey: Self.storageKey) }
    }

    private init() {
        baseURLString = UserDefaults.standard.string(forKey: Self.storageKey) ?? Self.defaultURLString
    }

    var baseURL: URL {
        URL(string: baseURLString) ?? URL(string: Self.defaultURLString)!
    }
}
