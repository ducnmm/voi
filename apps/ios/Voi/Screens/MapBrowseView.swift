import SwiftUI
import MapKit

/// Browse upcoming sessions on a map.
struct MapBrowseView: View {
    let sessions: [SessionSummary]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Map {
                ForEach(sessions) { session in
                    Marker(session.title, systemImage: "figure.badminton", coordinate: Mock.venueCoordinate(session.venueName))
                        .tint(VoiColor.court)
                }
            }
            .navigationTitle("Nearby")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
