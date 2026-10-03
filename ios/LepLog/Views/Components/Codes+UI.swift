import CoreImage.CIFilterBuiltins
import SwiftUI
import VisionKit

enum QR {
    static func image(_ text: String, scale: CGFloat = 10) -> UIImage? {
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        f.correctionLevel = "M"
        guard let out = f.outputImage?.transformed(by: CGAffineTransform(scaleX: scale, y: scale)),
              let cg = CIContext().createCGImage(out, from: out.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// A secret-ish code, masked until you ask to see it, with its QR and Copy.
struct RevealCodeCard: View {
    let label: String
    let value: String?
    var qrText: String?
    var helpText: String?
    var note: String?
    var autoHideSeconds: Int?

    @State private var shown = false
    @State private var copied = false

    var body: some View {
        Card(padding: 20) {
            VStack(spacing: 12) {
                Text(label.uppercased()).font(.caption).tracking(0.8).foregroundStyle(Color.inkSoft)
                Text(value.map { shown ? $0 : Codes.masked($0) } ?? "…")
                    .font(.title2.monospaced().bold())
                    .tracking(1.5)
                    .contentTransition(.numericText())
                    .textSelection(.enabled)
                if !shown {
                    Button("Reveal") { withAnimation { shown = true } }
                        .lepProminentButton()
                        .disabled(value == nil)
                } else if let value {
                    if let img = QR.image(qrText ?? value) {
                        Image(uiImage: img).interpolation(.none).resizable().scaledToFit()
                            .frame(width: 170, height: 170)
                            .padding(10)
                            .background(.white, in: RoundedRectangle(cornerRadius: 12))
                            .accessibilityLabel("QR code")
                    }
                    if let helpText { Text(helpText).font(.caption).foregroundStyle(Color.inkSoft) }
                    HStack(spacing: 10) {
                        Button(copied ? "Copied" : "Copy code", systemImage: copied ? "checkmark" : "doc.on.doc") {
                            UIPasteboard.general.string = value
                            copied = true
                            Task { try? await Task.sleep(for: .seconds(1.5)); copied = false }
                        }
                        .lepProminentButton()
                        Button("Hide") { withAnimation { shown = false } }.lepGlassButton()
                    }
                }
                if let note { Text(note).font(.caption2).foregroundStyle(Color.inkSoft) }
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
        }
        .task(id: shown) {
            guard shown, let s = autoHideSeconds else { return }
            try? await Task.sleep(for: .seconds(s))
            withAnimation { shown = false }
        }
    }
}

/// Live camera QR scanner for MOTH- and PAL- codes.
struct CodeScanner: View {
    let onCode: (Codes.Scanned) -> Void
    @Environment(\.dismiss) private var dismiss

    static var isAvailable: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    var body: some View {
        NavigationStack {
            ScannerRepresentable { text in
                if let parsed = Codes.parse(text) {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    onCode(parsed)
                    dismiss()
                }
            }
            .ignoresSafeArea()
            .navigationTitle("Scan a code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}

private struct ScannerRepresentable: UIViewControllerRepresentable {
    let onText: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr]), .text()],
                                           qualityLevel: .balanced, isHighlightingEnabled: true)
        vc.delegate = context.coordinator
        try? vc.startScanning()
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onText: onText) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onText: (String) -> Void
        init(onText: @escaping (String) -> Void) { self.onText = onText }

        func dataScanner(_ s: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            for item in items {
                switch item {
                case .barcode(let b): if let v = b.payloadStringValue { onText(v) }
                case .text(let t): onText(t.transcript)
                @unknown default: break
                }
            }
        }
    }
}
