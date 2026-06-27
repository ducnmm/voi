import SwiftUI

/// Sheet to leave a star rating + comment for a host or player.
struct WriteReviewView: View {
    let personName: String
    let onSubmit: (Int, String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var rating = 5
    @State private var comment = ""

    private var trimmed: String {
        comment.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Rating") {
                    HStack(spacing: VoiSpacing.sm) {
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= rating ? "star.fill" : "star")
                                .font(.title2)
                                .foregroundStyle(VoiColor.accent)
                                .onTapGesture { rating = star }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, VoiSpacing.sm)
                }

                Section("Comment") {
                    TextField("Share how it went…", text: $comment, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("Write a review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        onSubmit(rating, trimmed)
                        dismiss()
                    }
                    .disabled(trimmed.isEmpty)
                }
            }
        }
    }
}
