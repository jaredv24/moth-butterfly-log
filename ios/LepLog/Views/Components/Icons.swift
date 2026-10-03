import SwiftUI

// One icon family for the whole app: hand-drawn butterfly and moth glyphs (the wing
// shapes come from the app icon) and SF Symbols for everything else, all shown the
// same way — a tinted glyph in a soft round badge.

enum Glyph: Hashable {
    case butterfly, moth
    case symbol(String)

    var tint: Color {
        switch self {
        case .butterfly: .brand
        case .moth: .sun
        case .symbol: .brand
        }
    }
}

extension TaxonGroup {
    var glyph: Glyph { self == .moth ? .moth : .butterfly }
}

/// A glyph on its own, sized to fit its frame.
struct GlyphImage: View {
    let glyph: Glyph
    var color: Color? = nil

    var body: some View {
        let c = color ?? glyph.tint
        switch glyph {
        case .butterfly:
            ZStack {
                ButterflyWings().fill(c)
                ButterflyAntennae().stroke(c, style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
            }
            .aspectRatio(1, contentMode: .fit)
        case .moth:
            ZStack {
                MothWings().fill(c)
                MothAntennae().stroke(c, style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
            }
            .aspectRatio(1, contentMode: .fit)
        case .symbol(let name):
            Image(systemName: name).resizable().scaledToFit().foregroundStyle(c).fontWeight(.semibold)
        }
    }
}

/// The glyph in a tinted circle: list placeholders, group chips, rings, headers.
struct CritterBadge: View {
    let glyph: Glyph
    var size: CGFloat = 36
    var tint: Color? = nil

    var body: some View {
        let c = tint ?? glyph.tint
        ZStack {
            Circle().fill(c.opacity(0.15))
            GlyphImage(glyph: glyph, color: c).padding(size * 0.24)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Shapes (drawn in a 440×440 box centred on the body, like the app icon's SVG)

private func mapper(_ rect: CGRect) -> (CGFloat, CGFloat) -> CGPoint {
    let s = min(rect.width, rect.height) / 440
    let cx = rect.midX, cy = rect.midY + 25 * s
    return { x, y in CGPoint(x: cx + x * s, y: cy + y * s) }
}

private extension Path {
    mutating func curve(_ p: (CGFloat, CGFloat) -> CGPoint, _ c1: (CGFloat, CGFloat), _ c2: (CGFloat, CGFloat), _ to: (CGFloat, CGFloat)) {
        addCurve(to: p(to.0, to.1), control1: p(c1.0, c1.1), control2: p(c2.0, c2.1))
    }
}

struct ButterflyWings: Shape {
    func path(in rect: CGRect) -> Path {
        let p = mapper(rect)
        var path = Path()
        for m: CGFloat in [-1, 1] {
            // forewing
            path.move(to: p(22 * m, -128))
            path.curve(p, (22 * m, -150), (72 * m, -166), (138 * m, -166))
            path.curve(p, (208 * m, -166), (214 * m, -100), (194 * m, -52))
            path.curve(p, (180 * m, -14), (118 * m, -8), (22 * m, -14))
            path.closeSubpath()
            // hindwing
            path.move(to: p(22 * m, 4))
            path.curve(p, (92 * m, -2), (152 * m, 28), (148 * m, 76))
            path.curve(p, (144 * m, 116), (92 * m, 138), (54 * m, 128))
            path.curve(p, (26 * m, 120), (22 * m, 76), (22 * m, 38))
            path.closeSubpath()
        }
        let s = min(rect.width, rect.height) / 440
        path.addRoundedRect(in: CGRect(origin: p(-14, -140), size: CGSize(width: 28 * s, height: 264 * s)),
                            cornerSize: CGSize(width: 14 * s, height: 14 * s))
        return path
    }
}

struct ButterflyAntennae: Shape {
    func path(in rect: CGRect) -> Path {
        let p = mapper(rect)
        var path = Path()
        for m: CGFloat in [-1, 1] {
            path.move(to: p(4 * m, -138))
            path.curve(p, (10 * m, -176), (40 * m, -196), (66 * m, -190))
        }
        return path
    }
}

struct MothWings: Shape {
    func path(in rect: CGRect) -> Path {
        let p = mapper(rect)
        var path = Path()
        for m: CGFloat in [-1, 1] {
            // swept-back forewing
            path.move(to: p(20 * m, -96))
            path.curve(p, (70 * m, -132), (176 * m, -126), (214 * m, -70))
            path.curve(p, (196 * m, -26), (110 * m, 2), (20 * m, -6))
            path.closeSubpath()
            // small rounded hindwing
            path.move(to: p(20 * m, 6))
            path.curve(p, (84 * m, 4), (140 * m, 34), (128 * m, 72))
            path.curve(p, (110 * m, 104), (50 * m, 92), (20 * m, 54))
            path.closeSubpath()
        }
        for m: CGFloat in [-1, 1] {
            // feathered antenna: a slim leaf from the head
            path.move(to: p(6 * m, -118))
            path.addQuadCurve(to: p(84 * m, -192), control: p(4 * m, -184))
            path.addQuadCurve(to: p(6 * m, -118), control: p(74 * m, -128))
            path.closeSubpath()
        }
        // stout, furry body
        path.addEllipse(in: CGRect(x: p(-24, 0).x, y: p(0, -124).y,
                                   width: p(24, 0).x - p(-24, 0).x, height: p(0, 110).y - p(0, -124).y))
        return path
    }
}

/// Moth antennae are part of `MothWings` (filled feathers); nothing extra to stroke.
struct MothAntennae: Shape {
    func path(in rect: CGRect) -> Path { Path() }
}

#Preview {
    HStack(spacing: 16) {
        CritterBadge(glyph: .butterfly, size: 64)
        CritterBadge(glyph: .moth, size: 64)
        CritterBadge(glyph: .symbol("ladybug.fill"), size: 64)
        CritterBadge(glyph: .symbol("lizard.fill"), size: 64)
    }
    .padding()
}
