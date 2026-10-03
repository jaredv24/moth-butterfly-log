import PhotosUI
import SwiftUI

struct IdentifyScreen: View {
    @Environment(AppModel.self) private var model
    @State private var flow = IdentifyFlow()
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var picking = false
    @State private var sheetSpecies: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let error = flow.error { ErrorBanner(text: error) }
                    switch flow.step {
                    case .idle: idle
                    case .identifying, .results, .logging: inProgress
                    case .done: doneCard
                    }
                }
                .padding()
                .animation(.snappy, value: flow.step)
            }
            .paperBackground()
            .navigationTitle("Identify")
            .refreshable { await model.refreshLog() }
            .sheet(isPresented: $showCamera) {
                CameraPicker { img in
                    guard let p = PreparedPhoto.from(image: img) else { return }
                    Task { await flow.identify(p) }
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $picking) {
                SpeciesPicker(title: "What is it?") { sp in
                    picking = false
                    Task { await confirm { await flow.confirm(sp, code: $0) } }
                }
            }
            .sheet(item: Binding(get: { sheetSpecies.map(SpeciesKey.init) }, set: { sheetSpecies = $0?.key })) { k in
                SightingSheet(sightings: model.sightings(ofSpecies: k.key), owned: true)
            }
            .onChange(of: pickerItem) { _, item in
                guard let item else { return }
                pickerItem = nil
                Task {
                    guard let data = try? await item.loadTransferable(type: Data.self),
                          let p = PreparedPhoto.from(data: data) else {
                        flow.error = "Couldn't read that photo."
                        return
                    }
                    await flow.identify(p)
                }
            }
        }
    }

    private func confirm(_ action: (String) async -> Bool) async {
        guard let code = model.code else { return }
        if await action(code) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            await model.refreshLog()
        }
    }

    // MARK: Idle

    private var idle: some View {
        VStack(alignment: .leading, spacing: 20) {
            hero

            if let log = model.log {
                RecentStrip(log: log.log) { sheetSpecies = $0.speciesKey }
                LifeListCard(stats: log.stats, own: false, showChecklistLink: true)
            } else if model.logError == nil {
                HStack { Spacer(); ProgressView(); Spacer() }
            }
        }
    }

    /// The green "what did you find?" card with the two ways in.
    private var hero: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("What did you find?").font(.title2.bold())
                    Text("Snap a moth, butterfly, beetle, frog — anything. We'll identify it and add it to your life list.")
                        .font(.subheadline).opacity(0.85)
                }
                Spacer(minLength: 8)
                GlyphImage(glyph: .butterfly, color: .white.opacity(0.9)).frame(width: 52, height: 52).rotationEffect(.degrees(-12))
            }
            HStack(spacing: 10) {
                if CameraPicker.isAvailable {
                    Button { showCamera = true } label: {
                        Label("Take photo", systemImage: "camera.fill").heroButton(filled: true)
                    }
                }
                PhotosPicker(selection: $pickerItem, matching: .images, preferredItemEncoding: .current) {
                    Label("From Photos", systemImage: "photo.on.rectangle").heroButton(filled: !CameraPicker.isAvailable)
                }
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(.white)
        .padding(20)
        .background(
            LinearGradient(colors: [Color(hex: 0x4F8A5E), Color(hex: 0x2E5639)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 26, style: .continuous)
        )
        .shadow(color: Color(hex: 0x2E5639).opacity(0.3), radius: 16, y: 8)
    }

    // MARK: Identifying / results

    private var inProgress: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let img = flow.preview {
                VStack(spacing: 0) {
                    Image(uiImage: img)
                        .resizable().scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: 280)
                        .background(Color.line)
                    HStack(spacing: 12) {
                        if flow.cropped { Label("Cropped to subject", systemImage: "crop") }
                        if flow.locating { Label("Getting location…", systemImage: "location") }
                        if flow.step != .identifying {
                            Label(flow.placeLabel ?? "No location", systemImage: "mappin.and.ellipse")
                            if let at = flow.observedAt { Label(Format.day(at), systemImage: "clock") }
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(Color.inkSoft)
                    .labelStyle(.titleAndIcon)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                }
                .background(Color.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.line))
            }

            switch flow.step {
            case .identifying:
                progress("Identifying…", note: "The first identification after a quiet spell can take up to half a minute.")
            case .logging:
                progress("Saving to your log…")
            default:
                results
            }
        }
    }

    private func progress(_ title: String, note: String? = nil) -> some View {
        VStack(spacing: 8) {
            ProgressView()
            Text(title).font(.subheadline.weight(.medium))
            if let note { Text(note).font(.caption).foregroundStyle(Color.inkSoft).multilineTextAlignment(.center) }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(flow.candidates.isEmpty ? "No match found" : "Best matches — tap the right one")
                .font(.subheadline.weight(.semibold))
            ForEach(flow.candidates) { c in
                Button { Task { await confirm { await flow.confirm(c, code: $0) } } } label: {
                    CandidateRow(candidate: c)
                }
                .buttonStyle(.plain)
            }
            Button("None of these — pick the species myself") { picking = true }
                .buttonStyle(PillButtonStyle(filled: false))
            Button("Cancel") { flow.reset() }
                .font(.subheadline).foregroundStyle(Color.inkSoft).frame(maxWidth: .infinity)
        }
    }

    // MARK: Done

    private var doneCard: some View {
        Group {
            if let d = flow.done {
                Card(tint: .brand) {
                    VStack(spacing: 12) {
                        Image(systemName: d.isNewSpecies ? "sparkles" : "checkmark.seal.fill").font(.system(size: 44)).foregroundStyle(d.isNewSpecies ? Color.sun : Color.brand).symbolEffect(.bounce, value: d.isNewSpecies)
                        VStack(spacing: 2) {
                            Text(d.name).font(.title3.bold())
                            if !Format.sameName(d.name, d.scientific) {
                                Text(d.scientific).font(.subheadline).italic().foregroundStyle(Color.inkSoft)
                            }
                        }
                        Text(d.isNewSpecies ? "New species added to your life list!"
                             : d.checklisted ? "Already on your life list — sighting logged."
                             : d.otherGroup.map { "Logged under \($0)." } ?? "Logged under “other sightings.”")
                            .font(.subheadline)
                        SeenBadge(placeLabel: d.placeLabel, observedAt: d.observedAt)
                        HStack(spacing: 10) {
                            Button("Log another") { flow.reset() }.buttonStyle(PillButtonStyle())
                            Button("View checklist") {
                                flow.reset()
                                model.journalSection = .checklist
                                model.tab = .journal
                            }
                            .buttonStyle(PillButtonStyle(filled: false))
                        }
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                }
            }
        }
    }
}

private struct SpeciesKey: Identifiable {
    let key: String
    var id: String { key }
}

struct CandidateRow: View {
    let candidate: Candidate

    var body: some View {
        let c = candidate
        HStack(spacing: 12) {
            Thumb(url: c.match.thumbUrl, group: c.match.group, size: 58)
            VStack(alignment: .leading, spacing: 5) {
                SpeciesName(common: c.match.commonName, scientific: c.match.scientificName)
                HStack(spacing: 6) {
                    Text(Format.percent(c.confidence)).font(.caption2).foregroundStyle(Color.inkSoft)
                    if c.match.speciesId == nil {
                        if let g = c.otherGroup { Chip(text: g) }
                        else { Chip(text: "not on NA checklist", color: .warn, fill: Color.warn.opacity(0.15)) }
                    }
                    if c.match.matchLevel == .genus { Chip(text: "genus-level") }
                }
                if let p = c.plausibility { PlausibilityTag(p: p) }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Color.brand)
        }
        .padding(12)
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.line))
        .contentShape(Rectangle())
    }
}

private struct PlausibilityTag: View {
    let p: Candidate.Plausibility

    var body: some View {
        let (icon, fg, bg): (String, Color, Color) = switch p.verdict {
        case .expected: ("checkmark", .brand, Color.brand.opacity(0.15))
        case .outOfArea, .unusual: ("exclamationmark.triangle.fill", .warn, Color.warn.opacity(0.15))
        default: ("circle.fill", .inkSoft, .line)
        }
        Label(p.note, systemImage: icon)
            .font(.caption2.weight(.medium))
            .foregroundStyle(fg)
            .imageScale(.small)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(bg, in: RoundedRectangle(cornerRadius: 6))
    }
}

private struct RecentStrip: View {
    let log: [LogItem]
    let onOpen: (LogItem) -> Void

    var body: some View {
        let recent = Array(log.sorted { $0.observedAt > $1.observedAt }.prefix(10))
        if !recent.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Recent sightings").font(.headline)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(recent) { s in
                            Button { onOpen(s) } label: { card(s) }.buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .scrollClipDisabled()
            }
        }
    }

    private func card(_ s: LogItem) -> some View {
        Thumb(url: s.photoUrl, width: 140, height: 176, corner: 18)
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.identifiedName).font(.subheadline.weight(.semibold)).lineLimit(2)
                    Text(Format.day(s.observedAt)).font(.caption2).opacity(0.85)
                }
                .foregroundStyle(.white)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .top, endPoint: .bottom))
                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18, style: .continuous))
            }
            .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
    }
}

private extension View {
    func heroButton(filled: Bool) -> some View {
        self.font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .foregroundStyle(filled ? Color(hex: 0x2E5639) : .white)
            .background(filled ? AnyShapeStyle(.white) : AnyShapeStyle(.white.opacity(0.18)), in: Capsule())
            .overlay(Capsule().strokeBorder(.white.opacity(filled ? 0 : 0.5)))
            .contentShape(Capsule())
    }
}

extension Color {
    init(hex: UInt32) { self.init(UIColor(hex: hex)) }
}
