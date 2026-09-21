import SwiftUI

/// Ports `LogCard` from `components/LogView.tsx`: thumbnail, name, and a
/// place/date badge (📍 place · date, or 📅 date alone).
struct LogCardView: View {
    @ObservedObject private var apiConfig = APIConfig.shared
    let item: LogItem

    // Explicit init: a private stored property (`apiConfig`) would otherwise
    // make the compiler-synthesized memberwise init `private` too, which
    // would break construction from other files.
    init(item: LogItem) {
        self.item = item
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            AsyncImage(url: item.photoURL(base: apiConfig.baseURL)) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Rectangle().fill(.quaternary)
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.identifiedName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(item.identifiedScientific)
                    .font(.caption)
                    .italic()
                    .foregroundStyle(.secondary)

                HStack(spacing: 4) {
                    Text(item.placeLabel != nil ? "📍" : "📅")
                    Text(badgeText)
                }
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.lepGreen.opacity(0.12), in: Capsule())
                .foregroundStyle(Color.lepGreen)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }

    private var badgeText: String {
        let date = item.observedAt.formatted(date: .abbreviated, time: .omitted)
        if let place = item.placeLabel { return "\(place) · \(date)" }
        return date
    }
}
