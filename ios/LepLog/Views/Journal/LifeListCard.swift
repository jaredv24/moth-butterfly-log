import SwiftUI

/// Butterfly/moth checklist progress, plus every other kind of critter logged.
/// `own` prompts for empty categories so it's clear those count too.
struct LifeListCard: View {
    let stats: LogStats
    var own = true
    var showChecklistLink = false
    @Environment(AppModel.self) private var model

    private let tiers: [(label: String, kind: CritterKind, egs: String)] = [
        (BugGroups.arthropodLabel, .arthropod, "beetles, dragonflies, bees, spiders"),
        (BugGroups.critterLabel, .critter, "frogs, turtles, lizards, snakes"),
    ]

    var body: some View {
        Card {
            HStack {
                Text("Life list").font(.headline)
                Spacer()
                Text("\(stats.speciesTotal) species").font(.subheadline.weight(.medium)).foregroundStyle(Color.brand)
            }
            HStack(spacing: 12) {
                ProgressRing(label: "Butterflies", glyph: .butterfly, seen: stats.butterfliesSeen, total: stats.totalButterflies, color: .brand)
                ProgressRing(label: "Moths", glyph: .moth, seen: stats.mothsSeen, total: stats.totalMoths, color: .sun)
            }

            ForEach(tiers, id: \.kind) { tier in
                let groups = stats.otherGroups.filter { $0.kind == tier.kind }
                if !groups.isEmpty || own {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(tier.label).font(.caption.weight(.medium)).foregroundStyle(Color.inkSoft)
                            Spacer()
                            let n = groups.reduce(0) { $0 + $1.species }
                            if n > 0 { Text("\(n) species").font(.caption).foregroundStyle(Color.inkSoft) }
                        }
                        if groups.isEmpty {
                            Text("None yet — \(tier.egs) get logged here too.").font(.caption2).foregroundStyle(Color.inkSoft)
                        } else {
                            FlowLayout(spacing: 6) {
                                ForEach(groups) { g in
                                    GroupChip(group: g.group, count: g.species)
                                }
                            }
                        }
                    }
                    .padding(.top, 2)
                }
            }

            if showChecklistLink {
                Button {
                    model.journalSection = .checklist
                    model.tab = .journal
                } label: {
                    Label("Browse the full checklist", systemImage: "arrow.right").labelStyle(TrailingIcon())
                }
                .font(.subheadline.weight(.medium))
                .padding(.top, 2)
            }
        }
    }
}

/// Checklist progress as a ring: seen of total, with the percentage inside.
struct ProgressRing: View {
    let label: String
    let glyph: Glyph
    let seen: Int
    let total: Int
    let color: Color

    private var fraction: Double { total > 0 ? Double(seen) / Double(total) : 0 }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().stroke(color.opacity(0.18), lineWidth: 7)
                Circle()
                    .trim(from: 0, to: max(fraction, seen > 0 ? 0.015 : 0))
                    .stroke(color, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                GlyphImage(glyph: glyph, color: color).frame(width: 26, height: 26)
            }
            .frame(width: 54, height: 54)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(seen)").font(.title2.bold()).monospacedDigit().foregroundStyle(Color.ink)
                Text("of \(total) \(label.lowercased())").font(.caption).foregroundStyle(Color.inkSoft)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(seen) of \(total)")
    }
}

private struct TrailingIcon: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) { configuration.title; configuration.icon }
    }
}

/// Wraps chips onto as many lines as they need.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for i in row.indices {
                let size = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for i in subviews.indices {
            let size = subviews[i].sizeThatFits(.unspecified)
            let needed = rows[rows.count - 1].indices.isEmpty ? size.width : rows[rows.count - 1].width + spacing + size.width
            if needed > width, !rows[rows.count - 1].indices.isEmpty {
                rows.append(Row())
            }
            var r = rows[rows.count - 1]
            r.width = r.indices.isEmpty ? size.width : r.width + spacing + size.width
            r.height = max(r.height, size.height)
            r.indices.append(i)
            rows[rows.count - 1] = r
        }
        return rows.filter { !$0.indices.isEmpty }
    }
}

/// "Beetles · 3" with the group's icon.
struct GroupChip: View {
    let group: String
    let count: Int

    var body: some View {
        HStack(spacing: 5) {
            GlyphImage(glyph: BugGroups.glyph(group), color: .brand).frame(width: 12, height: 12)
            Text("\(group) · \(count)")
        }
        .font(.caption2.weight(.medium))
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.brand.opacity(0.1), in: Capsule())
    }
}
