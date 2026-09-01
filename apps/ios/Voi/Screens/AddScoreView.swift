import SwiftUI

/// Sheet to record a match result for a session.
struct AddScoreView: View {
    let onAdd: (String, Int, Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var label = "Court 1"
    @State private var scoreA = 21
    @State private var scoreB = 15

    var body: some View {
        NavigationStack {
            Form {
                Section("Match") {
                    TextField("Label", text: $label)
                        .accessibilityIdentifier(A11y.Score.label)
                }
                Section("Score") {
                    Stepper("Team A: \(scoreA)", value: $scoreA, in: 0...30)
                    Stepper("Team B: \(scoreB)", value: $scoreB, in: 0...30)
                }
            }
            .navigationTitle("Add result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier(A11y.Score.cancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onAdd(label.trimmingCharacters(in: .whitespacesAndNewlines), scoreA, scoreB)
                        dismiss()
                    }
                    .accessibilityIdentifier(A11y.Score.save)
                }
            }
        }
    }
}
