import SwiftUI
import CoreImage.CIFilterBuiltins

enum QRCodeImage {
    static func make(_ string: String) -> Image {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        if let output = filter.outputImage {
            let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
            if let cg = context.createCGImage(scaled, from: scaled.extent) {
                return Image(decorative: cg, scale: 1)
            }
        }
        return Image(systemName: "qrcode")
    }
}
