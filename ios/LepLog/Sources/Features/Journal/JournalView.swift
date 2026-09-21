import SwiftUI

struct JournalView: View {
    @StateObject private var viewModel: JournalViewModel
    @State private var pendingDelete: LogItem?

    init(code: String) {
        _viewModel = StateObject(wrappedValue: JournalViewModel(code: code))
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Journal")
                .task { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.status {
        case .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .error(let message):
            errorState(message)
        case .ready:
            if viewModel.isEmpty {
                emptyState
            } else {
                list
            }
        }
    }

    private var list: some View {
        List {
            Section {
                Picker("Sort by", selection: $viewModel.sortBy) {
                    ForEach(LogSortOption.allCases) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
            }

            if !viewModel.onChecklist.isEmpty {
                Section("Butterflies & moths · \(viewModel.onChecklist.count)") {
                    rows(for: viewModel.onChecklist)
                }
            }

            ForEach(viewModel.arthropodTiers) { section in
                Section("\(section.group) · \(section.items.count)") {
                    rows(for: section.items)
                }
            }

            ForEach(viewModel.critterTiers) { section in
                Section("\(section.group) · \(section.items.count)") {
                    rows(for: section.items)
                }
            }
        }
        .refreshable { await viewModel.load() }
        .confirmationDialog(
            "Delete this sighting?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { isPresented in if !isPresented { pendingDelete = nil } }
            ),
            presenting: pendingDelete
        ) { item in
            Button("Delete", role: .destructive) {
                Task { await viewModel.delete(item) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { item in
            Text("Delete your \(item.identifiedName) sighting? This can't be undone.")
        }
    }

    private func rows(for items: [LogItem]) -> some View {
        ForEach(items) { item in
            LogCardView(item: item)
                .swipeActions {
                    Button("Delete", role: .destructive) {
                        pendingDelete = item
                    }
                }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "camera.macro")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("Nothing logged yet.")
                .font(.headline)
            Text("Photograph anything from the Identify tab and it's identified and sorted here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32))
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
