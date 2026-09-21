import Foundation

enum LogSortOption: String, CaseIterable, Identifiable {
    case observedAt = "Date seen"
    case createdAt = "Date added"
    var id: String { rawValue }
}

enum LoadStatus: Equatable {
    case loading
    case ready
    case error(String)
}

/// Ports `LogView.tsx`'s data shaping: split on-checklist sightings from
/// off-checklist ones, bucket the latter into arthropod/critter tiers by
/// group, and sort everything by either the photo date (`observedAt`) or the
/// actual upload date (`createdAt`) — the option added to the web log.
@MainActor
final class JournalViewModel: ObservableObject {
    @Published private(set) var response: LogResponse?
    @Published private(set) var status: LoadStatus = .loading
    @Published var sortBy: LogSortOption = .observedAt

    private let code: String

    init(code: String) {
        self.code = code
    }

    private var entries: [LogItem] { response?.log ?? [] }

    var isEmpty: Bool { entries.isEmpty }

    var onChecklist: [LogItem] {
        sorted(entries.filter { $0.speciesId != nil })
    }

    struct GroupSection: Identifiable {
        var id: String { group }
        let group: String
        let items: [LogItem]
    }

    var arthropodTiers: [GroupSection] { otherTiers(kind: .arthropod) }
    var critterTiers: [GroupSection] { otherTiers(kind: .critter) }

    private func otherTiers(kind: CritterKind) -> [GroupSection] {
        var byGroup: [String: [LogItem]] = [:]
        for item in entries where item.speciesId == nil {
            let group = item.otherGroup ?? "Other critters"
            byGroup[group, default: []].append(item)
        }
        return byGroup
            .filter { BugGroups.kind(for: $0.key) == kind }
            .map { GroupSection(group: $0.key, items: sorted($0.value)) }
            .sorted { $0.items.count > $1.items.count }
    }

    private func sorted(_ items: [LogItem]) -> [LogItem] {
        switch sortBy {
        case .observedAt:
            return items.sorted { $0.observedAt > $1.observedAt }
        case .createdAt:
            return items.sorted { $0.createdAt > $1.createdAt }
        }
    }

    func load() async {
        status = .loading
        do {
            let result: LogResponse = try await APIClient.shared.get(
                "/api/log",
                query: ["code": code]
            )
            response = result
            status = .ready
        } catch {
            status = .error((error as? LocalizedError)?.errorDescription ?? "Couldn't load the log.")
        }
    }

    func delete(_ item: LogItem) async {
        do {
            let _: OkResponse = try await APIClient.shared.delete(
                "/api/log",
                body: ["code": code, "sightingId": item.id]
            )
            await load()
        } catch {
            status = .error((error as? LocalizedError)?.errorDescription ?? "Couldn't delete that sighting.")
        }
    }
}
