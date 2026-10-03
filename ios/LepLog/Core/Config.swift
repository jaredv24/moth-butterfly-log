import Foundation

enum Config {
    static let productionURL = URL(string: "https://moth-butterfly-log.vercel.app")!

    /// The simulator talks to the local dev server (`npm run dev`); a real phone (and
    /// every release build) talks to production, since it can't reach this Mac's localhost.
    /// Debug override: `-lepBaseURL https://moth-butterfly-log.vercel.app`.
    static let baseURL: URL = {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "lepBaseURL"), let url = URL(string: override) {
            return url
        }
        #endif
        #if DEBUG && targetEnvironment(simulator)
        return URL(string: "http://localhost:3000")!
        #else
        return productionURL
        #endif
    }()

    /// The custom scheme iNaturalist's sign-in hands back to.
    static let callbackScheme = "leplog"
}
