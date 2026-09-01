import SwiftUI
import UIKit

/// Brand palette. The primary brand colour is the original green; neutrals and
/// brand colours adapt between light and dark appearance.
enum VoiColor {
    static let background = Color.adaptive(light: 0xF7F7F5, dark: 0x111214)
    static let surface    = Color.adaptive(light: 0xFFFFFF, dark: 0x1D1E21)
    static let ink        = Color.adaptive(light: 0x14171A, dark: 0xF2F3F5)
    static let muted      = Color.adaptive(light: 0x737880, dark: 0x9AA0A8)
    static let line       = Color.adaptive(light: 0xDEDED9, dark: 0x34363B)
    /// Primary brand colour: the brand green, brightened in dark mode so it
    /// keeps strong contrast against the dark background.
    static let court      = Color.adaptive(light: 0x246E57, dark: 0x4FBF99)
    /// Secondary warm accent for status (e.g. "Maybe", "Full").
    static let accent     = Color.adaptive(light: 0xE86138, dark: 0xF2885E)
}

extension Color {
    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    /// Resolves to `light` or `dark` (each 0xRRGGBB) based on the active
    /// interface style — also honouring an app-level `.preferredColorScheme`.
    static func adaptive(light: UInt, dark: UInt) -> Color {
        Color(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

enum VoiSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
}

enum VoiRadius {
    /// Full-width surfaces and cards, matching the Home session cards.
    static let card: CGFloat = 12
    static let control: CGFloat = 10
    static let compact: CGFloat = 8
    static let prominent: CGFloat = 16
    static let message: CGFloat = 18
}

struct CapsuleLabel: View {
    let text: String
    let systemImage: String?

    init(_ text: String, systemImage: String? = nil) {
        self.text = text
        self.systemImage = systemImage
    }

    var body: some View {
        HStack(spacing: VoiSpacing.xs) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            // Treat the text as a localization key so enum labels (e.g. skill
            // levels) translate; plain/interpolated strings fall through as-is.
            Text(LocalizedStringKey(text))
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(VoiColor.ink)
        .padding(.horizontal, VoiSpacing.md)
        .padding(.vertical, VoiSpacing.sm)
        .background(VoiColor.background)
        .clipShape(Capsule())
    }
}

/// Circular avatar that loads a remote image, falling back to the initials while
/// loading, when offline, or when no URL is set.
struct AvatarView: View {
    let url: URL?
    let initials: String
    var size: CGFloat = 40

    var body: some View {
        Circle()
            .fill(VoiColor.court.opacity(0.16))
            .frame(width: size, height: size)
            .overlay {
                if let url {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            initialsText
                        }
                    }
                } else {
                    initialsText
                }
            }
            .clipShape(Circle())
    }

    private var initialsText: some View {
        Text(initials)
            .font(.system(size: size * 0.4, weight: .bold))
            .foregroundStyle(VoiColor.court)
    }
}

/// Small capsule conveying a session's status (full, filling up, soon, …).
/// Renders nothing for an unremarkable open session.
struct StatusBadge: View {
    let status: SessionStatus

    var body: some View {
        if let badge {
            Text(badge.label)
                .font(.caption2.weight(.bold))
                .foregroundStyle(badge.color)
                .padding(.horizontal, VoiSpacing.sm)
                .padding(.vertical, 3)
                .background(badge.color.opacity(0.14), in: Capsule())
        }
    }

    private var badge: (label: LocalizedStringKey, color: Color)? {
        switch status {
        case .cancelled: ("Cancelled", .red)
        case .ended: ("Ended", VoiColor.muted)
        case .full: ("Full", VoiColor.accent)
        case .fillingUp: ("Few spots left", VoiColor.accent)
        case .soon: ("Starting soon", VoiColor.court)
        case .open: nil
        }
    }
}

extension View {
    /// Suppresses the soft, dimmed "scroll edge" pocket that iOS 26 lays over
    /// content at the bottom of a scroll view (the white band that appears to
    /// cover the last row). `.hard` keeps the content crisp to the edge. No-op
    /// before iOS 26.
    @ViewBuilder
    func hardBottomScrollEdge() -> some View {
        if #available(iOS 26.0, *) {
            scrollEdgeEffectStyle(.hard, for: .bottom)
        } else {
            self
        }
    }

    /// Adds bottom padding equal to the home-indicator safe-area inset.
    ///
    /// `RootView` hosts the pages in a page-style `TabView`, which draws its
    /// content to the physical bottom edge and hands child scroll views a zero
    /// bottom inset. Without this, the last card sits under the home indicator.
    /// Returns 0pt on devices without a home indicator.
    func voiBottomSafeAreaPadding() -> some View {
        padding(.bottom, UIApplication.shared.voiBottomSafeAreaInset)
    }

    func voiCard() -> some View {
        self
            .padding(VoiSpacing.lg)
            .background(VoiColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous)
                    .stroke(VoiColor.line, lineWidth: 1)
            )
    }
}

private extension UIApplication {
    var voiBottomSafeAreaInset: CGFloat {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .safeAreaInsets.bottom ?? 0
    }
}
