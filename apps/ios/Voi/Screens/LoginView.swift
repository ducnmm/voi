import SwiftUI
import GoogleSignIn

/// Minimal sign-in screen: a blank background with a single circular Google
/// button in the centre and nothing else.
struct LoginView: View {
    let onLogin: () -> Void
    @EnvironmentObject private var environment: AppEnvironment
    @State private var isSigningIn = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            VoiColor.background
                .ignoresSafeArea()

            Button {
                Task { await signInWithGoogle() }
            } label: {
                AsyncImage(url: URL(string: "https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png")) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        GoogleLogo() // fallback while loading / offline
                    }
                }
                .frame(width: 40, height: 40)
                .frame(width: 84, height: 84)
                .background(VoiColor.surface, in: Circle())
                .overlay(Circle().stroke(VoiColor.line, lineWidth: 1))
                .shadow(color: VoiColor.ink.opacity(0.12), radius: 14, x: 0, y: 6)
            }
            .buttonStyle(.plain)
            .disabled(isSigningIn)
            .accessibilityLabel("Sign in with Google")
        }
        .alert("Sign-in failed", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func signInWithGoogle() async {
        guard !isSigningIn,
              let rootViewController = UIApplication.shared.firstKeyWindow?.rootViewController
        else { return }
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)
            guard let idToken = result.user.idToken?.tokenString else { return }
            let response = try await environment.apiClient.googleLogin(idToken: idToken)
            environment.authSession.signIn(google: response)
            onLogin()
        } catch {
            let nsError = error as NSError
            // Ignore a user-cancelled Google sign-in (GIDSignInError.canceled).
            if nsError.domain == "com.google.GIDSignIn", nsError.code == -5 { return }
            if let apiError = error as? APIErrorResponse {
                errorMessage = apiError.error.message
            } else {
                errorMessage = "\(error.localizedDescription) (\(nsError.domain) \(nsError.code))"
            }
        }
    }
}

extension UIApplication {
    var firstKeyWindow: UIWindow? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }?
            .keyWindow
    }
}

/// The multicolour Google "G", drawn with SwiftUI (no asset needed).
struct GoogleLogo: View {
    private let blue = Color(red: 66 / 255, green: 133 / 255, blue: 244 / 255)
    private let red = Color(red: 234 / 255, green: 67 / 255, blue: 53 / 255)
    private let yellow = Color(red: 250 / 255, green: 187 / 255, blue: 5 / 255)
    private let green = Color(red: 52 / 255, green: 168 / 255, blue: 83 / 255)

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let lineWidth = size * 0.24
            let radius = (size - lineWidth) / 2
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let barWidth = radius * 1.05

            ZStack {
                arc(center: center, radius: radius, lineWidth: lineWidth, from: 8, to: 70, color: blue)
                arc(center: center, radius: radius, lineWidth: lineWidth, from: 70, to: 160, color: green)
                arc(center: center, radius: radius, lineWidth: lineWidth, from: 160, to: 250, color: yellow)
                arc(center: center, radius: radius, lineWidth: lineWidth, from: 250, to: 322, color: red)

                // The "G" crossbar.
                Capsule()
                    .fill(blue)
                    .frame(width: barWidth, height: lineWidth)
                    .position(x: center.x + radius * 0.5, y: center.y)
            }
        }
    }

    private func arc(center: CGPoint, radius: CGFloat, lineWidth: CGFloat, from: Double, to: Double, color: Color) -> some View {
        Path { path in
            path.addArc(center: center, radius: radius, startAngle: .degrees(from), endAngle: .degrees(to), clockwise: false)
        }
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .butt))
    }
}
