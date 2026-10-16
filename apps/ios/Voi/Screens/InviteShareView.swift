import SwiftUI
import UIKit

struct InviteSharePayload: Identifiable {
    let title: String
    let detail: String
    let url: URL
    var id: String { url.absoluteString }
}

/// QR + tappable/copyable link for the three invite kinds.
struct InviteShareView: View {
    let title: String
    let detail: String
    let url: URL

    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        NavigationStack {
            VStack(spacing: VoiSpacing.lg) {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)
                    .multilineTextAlignment(.center)

                QRCodeImage.make(url.absoluteString)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 220, height: 220)
                    .padding(VoiSpacing.lg)
                    .background(VoiColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: VoiRadius.prominent, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: VoiRadius.prominent, style: .continuous)
                            .stroke(VoiColor.line, lineWidth: 1)
                    )
                    .accessibilityLabel("QR code")
                    .accessibilityIdentifier(A11y.Share.qr)

                Text(url.absoluteString)
                    .font(.footnote.monospaced())
                    .foregroundStyle(VoiColor.ink)
                    .multilineTextAlignment(.center)
                    .textSelection(.enabled)
                    .accessibilityIdentifier(A11y.Share.link)

                HStack(spacing: VoiSpacing.md) {
                    Button {
                        UIPasteboard.general.string = url.absoluteString
                        copied = true
                    } label: {
                        Label(copied ? "Copied" : "Copy link", systemImage: copied ? "checkmark" : "link")
                            .frame(maxWidth: .infinity)
                    }
                    .accessibilityIdentifier(A11y.Share.copy)

                    ShareLink(item: url) {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .accessibilityIdentifier(A11y.Share.send)
                }
                .buttonStyle(.bordered)

                Spacer()
            }
            .padding(VoiSpacing.lg)
            .frame(maxWidth: .infinity)
            .background(VoiColor.background)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
