import SwiftUI

/// First-run intro shown until the user taps "Get started".
struct OnboardingView: View {
    let onFinish: () -> Void
    @State private var page = 0

    private struct Slide: Identifiable {
        let id: Int
        let icon: String
        let title: LocalizedStringKey
        let detail: LocalizedStringKey
    }

    private let slides: [Slide] = [
        Slide(id: 0, icon: "figure.badminton", title: "Find a game",
              detail: "Browse upcoming badminton sessions and grab a spot in seconds."),
        Slide(id: 1, icon: "person.2.fill", title: "Play together",
              detail: "See who's in, hop on the waitlist, and split the cost fairly."),
        Slide(id: 2, icon: "star.fill", title: "Build your rep",
              detail: "Rate hosts and players and grow your badminton reputation.")
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                ForEach(slides) { slide in
                    VStack(spacing: VoiSpacing.lg) {
                        Image(systemName: slide.icon)
                            .font(.system(size: 72, weight: .semibold))
                            .foregroundStyle(VoiColor.court)
                        Text(slide.title)
                            .font(.title.bold())
                            .foregroundStyle(VoiColor.ink)
                        Text(slide.detail)
                            .font(.body)
                            .foregroundStyle(VoiColor.muted)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, VoiSpacing.xl)
                    }
                    .tag(slide.id)
                }
            }
            .tabViewStyle(.page)

            Button {
                if page < slides.count - 1 {
                    withAnimation { page += 1 }
                } else {
                    onFinish()
                }
            } label: {
                Text(page < slides.count - 1 ? "Next" : "Get started")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, VoiSpacing.md)
                    .background(VoiColor.court)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(VoiSpacing.lg)
            .accessibilityIdentifier(page < slides.count - 1 ? A11y.Onboarding.next : A11y.Onboarding.getStarted)
        }
        .background(VoiColor.background)
    }
}
