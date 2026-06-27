import SwiftUI
import CoreImage.CIFilterBuiltins

/// Mock payment screen: shows a QR for the amount owed and an "I've paid" button.
struct PaymentQRView: View {
    let amount: Int
    let sessionTitle: String
    let onMarkPaid: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: VoiSpacing.md) {
                Text(CurrencyFormatter.vnd(amount))
                    .font(.largeTitle.bold())
                    .foregroundStyle(VoiColor.ink)
                Text(sessionTitle)
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)

                qrImage
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 220, height: 220)
                    .padding(VoiSpacing.lg)
                    .background(VoiColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(VoiColor.line, lineWidth: 1)
                    )
                    .padding(.top, VoiSpacing.lg)

                Text("Scan with your banking app (VietQR / Momo).")
                    .font(.caption)
                    .foregroundStyle(VoiColor.muted)

                Spacer()

                Button {
                    onMarkPaid()
                    dismiss()
                } label: {
                    Text("I've paid")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, VoiSpacing.md)
                        .background(VoiColor.court)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(VoiSpacing.lg)
            .frame(maxWidth: .infinity)
            .background(VoiColor.background)
            .navigationTitle("Payment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var qrImage: Image {
        let payload = "voipay://pay?title=\(sessionTitle)&amount=\(amount)"
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(payload.utf8)
        if let output = filter.outputImage,
           let cg = context.createCGImage(output, from: output.extent) {
            return Image(decorative: cg, scale: 1)
        }
        return Image(systemName: "qrcode")
    }
}
