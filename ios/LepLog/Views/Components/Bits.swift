import SwiftUI

/// Remote image that falls back to a critter-icon tile, so a dead URL never shows a broken image.
struct Thumb: View {
    let url: String?
    var group: TaxonGroup? = nil
    var fallback: Glyph? = nil
    var size: CGFloat? = nil
    /// Fixed width/height for non-square tiles; the photo fills and is cropped to it.
    var width: CGFloat? = nil
    var height: CGFloat? = nil
    var corner: CGFloat = 10

    var body: some View {
        let w = width ?? size, h = height ?? size
        // The tile sets the size and the photo fills it and gets cropped — never the other way
        // round, or wide photos spill past the tile.
        Color.clear
            .frame(width: w, height: h)
            .frame(maxWidth: w == nil ? .infinity : nil, maxHeight: h == nil ? .infinity : nil)
            .overlay { content }
            .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }

    @ViewBuilder private var content: some View {
        if let url, let u = URL(string: url, relativeTo: Config.baseURL) {
            AsyncImage(url: u, transaction: Transaction(animation: .easeOut(duration: 0.15))) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                case .failure: placeholder
                default: Color.line
                }
            }
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        ZStack {
            Color.brand.opacity(0.1)
            GlyphImage(glyph: fallback ?? group?.glyph ?? .butterfly).frame(width: (size ?? min(width ?? 60, height ?? 60)) * 0.5)
        }
    }
}

/// Common name over the scientific name, but only when they differ.
struct SpeciesName: View {
    let common: String
    let scientific: String
    var font: Font = .subheadline.weight(.medium)

    var body: some View {
        let same = Format.sameName(common, scientific)
        VStack(alignment: .leading, spacing: 1) {
            Text(common).font(font).italic(same).foregroundStyle(Color.ink).lineLimit(1)
            if !same {
                Text(scientific).font(.caption).italic().foregroundStyle(Color.inkSoft).lineLimit(1)
            }
        }
    }
}

/// "Austin, Texas · Sep 6, 2026" with a pin, on checked-off species.
struct SeenBadge: View {
    let placeLabel: String?
    let observedAt: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: placeLabel == nil ? "calendar" : "mappin.and.ellipse")
            Text((placeLabel.map { "\($0) · " } ?? "") + Format.day(observedAt)).lineLimit(1)
        }
        .font(.caption2.weight(.medium))
        .foregroundStyle(Color.brand)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Color.brand.opacity(0.12), in: Capsule())
    }
}

struct ProgressRow: View {
    let label: String
    let seen: Int
    let total: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(label).font(.subheadline.weight(.medium))
                Spacer()
                Text("\(seen) / \(total)").font(.subheadline).foregroundStyle(Color.inkSoft).monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.line)
                    Capsule().fill(Color.brand)
                        .frame(width: total > 0 ? max(geo.size.width * CGFloat(seen) / CGFloat(total), seen > 0 ? 6 : 0) : 0)
                }
            }
            .frame(height: 8)
        }
        .accessibilityElement(children: .combine)
    }
}

struct AvatarView: View {
    let url: String?
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            Circle().fill(Color.line)
            if let url, let u = URL(string: url, relativeTo: Config.baseURL) {
                AsyncImage(url: u) { img in img.resizable().scaledToFill() } placeholder: { icon }
            } else {
                icon
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var icon: some View {
        Image(systemName: "person.fill").font(.system(size: size * 0.42)).foregroundStyle(Color.inkSoft)
    }
}

/// Small badge count ("3", "9+").
struct CountBadge: View {
    let count: Int
    var body: some View {
        Text(count > 9 ? "9+" : "\(count)")
            .font(.caption2.bold())
            .foregroundStyle(Color.onBrand)
            .padding(.horizontal, 6)
            .frame(minWidth: 20, minHeight: 20)
            .background(Color.brand, in: Capsule())
    }
}

/// A full-screen photo you can pinch and drag; tap or swipe down to close.
struct Lightbox: View {
    let url: String
    @Environment(\.dismiss) private var dismiss
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            AsyncImage(url: URL(string: url, relativeTo: Config.baseURL)) { phase in
                if let img = phase.image {
                    img.resizable().scaledToFit()
                } else if phase.error != nil {
                    Image(systemName: "photo").font(.largeTitle).foregroundStyle(.white.opacity(0.6))
                } else {
                    ProgressView().tint(.white)
                }
            }
            .scaleEffect(scale)
            .offset(offset)
            .gesture(
                MagnifyGesture()
                    .onChanged { scale = max(1, lastScale * $0.magnification) }
                    .onEnded { _ in
                        lastScale = scale
                        if scale == 1 { withAnimation { offset = .zero } }
                    }
                    .simultaneously(with: DragGesture()
                        .onChanged { offset = $0.translation }
                        .onEnded { v in
                            if scale == 1, v.translation.height > 120 { dismiss() }
                            else if scale == 1 { withAnimation { offset = .zero } }
                        })
            )
            .onTapGesture(count: 2) {
                withAnimation { scale = scale > 1 ? 1 : 2.5; lastScale = scale; if scale == 1 { offset = .zero } }
            }
            .onTapGesture { if scale == 1 { dismiss() } }
            .ignoresSafeArea()

            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.headline).foregroundStyle(.white).frame(width: 36, height: 36)
            }
            .lepGlass(in: Circle())
            .padding()
            .accessibilityLabel("Close")
        }
    }
}

/// `.fullScreenCover(item:)` needs Identifiable.
struct PhotoRef: Identifiable {
    let url: String
    var id: String { url }
}

extension View {
    func lightbox(_ item: Binding<PhotoRef?>) -> some View {
        fullScreenCover(item: item) { Lightbox(url: $0.url) }
    }
}

struct EmptyNote: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(Color.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.line))
    }
}

struct ErrorBanner: View {
    let text: String
    var body: some View {
        Label(text, systemImage: "exclamationmark.triangle.fill")
            .font(.subheadline)
            .foregroundStyle(Color.danger)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color.danger.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
