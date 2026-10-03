import SwiftUI
import UIKit

// The same palette as the website (app/globals.css), light and dark.
extension Color {
    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
    // Dark mode is a deep forest green rather than near-black.
    static let paper = dynamic(0xF4F1E8, 0x13201A)
    static let surface = dynamic(0xFFFFFF, 0x1B2B23)
    static let ink = dynamic(0x1C1A17, 0xEAF0E6)
    static let inkSoft = dynamic(0x6B6459, 0xA6B6A9)
    static let line = dynamic(0xE7E1D4, 0x2B3E33)
    static let brand = dynamic(0x3F6F4C, 0x8CCB98)
    static let brandDeep = dynamic(0x2E5639, 0x2F5A3C)
    static let onBrand = dynamic(0xFFFFFF, 0x0F2216)
    static let sun = dynamic(0xE9A23B, 0xF2B85C)
    static let warn = dynamic(0xB45309, 0xFBBF24)
    static let danger = dynamic(0xDC2626, 0xF87171)
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

/// The site's rounded, bordered card.
struct Card<Content: View>: View {
    var padding: CGFloat = 16
    var tint: Color? = nil
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(tint.map { AnyShapeStyle($0.opacity(0.10)) } ?? AnyShapeStyle(Color.surface),
                        in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(tint.map { $0.opacity(0.35) } ?? Color.line.opacity(0.6), lineWidth: 0.5))
            .shadow(color: Color.brandDeep.opacity(0.08), radius: 12, y: 4)
    }
}

/// Small rounded label: "Beetles · 3", "genus-level", "mutual".
struct Chip: View {
    let text: String
    var color: Color = .inkSoft
    var fill: Color = .line

    var body: some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(fill, in: Capsule())
    }
}

/// Rounded pill button in the brand color (or outlined).
struct PillButtonStyle: ButtonStyle {
    var filled = true
    var destructive = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 16)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity)
            .foregroundStyle(filled ? Color.onBrand : destructive ? Color.danger : Color.ink)
            .background(filled ? Color.brand : Color.surface, in: Capsule())
            .overlay(Capsule().strokeBorder(filled ? Color.clear : destructive ? Color.danger.opacity(0.5) : Color.line))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

// MARK: - Liquid Glass (iOS 26), with a frosted fallback on older iOS

extension View {
    /// Glass for the controls layer (floating buttons, bars). Content stays solid, per Apple's guidance.
    @ViewBuilder
    func lepGlass<S: Shape>(in shape: S, tint: Color? = nil, interactive: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(interactive ? Glass.regular.tint(tint).interactive() : Glass.regular.tint(tint), in: shape)
        } else {
            self.background(tint.map { AnyShapeStyle($0.opacity(0.9)) } ?? AnyShapeStyle(.ultraThinMaterial), in: shape)
                .overlay(shape.stroke(Color.line.opacity(0.6), lineWidth: 0.5))
        }
    }

    /// The brand-tinted primary action.
    @ViewBuilder
    func lepProminentButton() -> some View {
        if #available(iOS 26.0, *) {
            self.buttonStyle(.glassProminent).tint(.brand)
        } else {
            self.buttonStyle(.borderedProminent).tint(.brand).buttonBorderShape(.capsule)
        }
    }

    /// A secondary glass button.
    @ViewBuilder
    func lepGlassButton() -> some View {
        if #available(iOS 26.0, *) {
            self.buttonStyle(.glass)
        } else {
            self.buttonStyle(.bordered).buttonBorderShape(.capsule)
        }
    }

    /// The paper background behind a scrolling screen, with a soft green wash at the top.
    func paperBackground() -> some View {
        self.scrollContentBackground(.hidden).background(PaperBackground())
    }
}

struct PaperBackground: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.paper
            LinearGradient(colors: [Color.brand.opacity(0.16), Color.brand.opacity(0)], startPoint: .top, endPoint: .bottom)
                .frame(height: 360)
        }
        .ignoresSafeArea()
    }
}
