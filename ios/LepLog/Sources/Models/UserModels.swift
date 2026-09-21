import Foundation

/// Wire shape of `POST /api/user` (create/adopt a code) and the profile
/// fields read back with it.
struct UserSession: Codable {
    let code: String
    let created: Bool
    let username: String?
    let nickname: String?
    let avatarUrl: String?
    let hasPassword: Bool
}
