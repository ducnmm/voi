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
                    if let coordinate = session.mapCoordinate {
                        Marker(session.title, systemImage: "figure.badminton", coordinate: coordinate)
                            .tint(VoiColor.court)
                    }
                }
            }
            .overlay {
                if sessions.allSatisfy({ $0.mapCoordinate == nil }) {
                    ContentUnavailableView("No venue locations", systemImage: "mappin.slash", description: Text("Venue coordinates have not been verified."))
                }
            }
            .accessibilityIdentifier(A11y.Map.screen)
            .navigationTitle("Nearby")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier(A11y.Map.done)
                }
            }
        }
    }
}
