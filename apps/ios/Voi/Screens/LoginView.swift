import SwiftUI
import AuthenticationServices
import GoogleSignIn

/// Sign-in screen. Sign in with Apple is the same width as Google so the
/// two options are equally prominent (App Store guideline 4.8).
struct LoginView: View {
    let onLogin: () -> Void
    @EnvironmentObject private var environment: AppEnvironment
    @Environment(\.colorScheme) private var colorScheme
    @State private var isSigningIn = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            VoiColor.background
                .ignoresSafeArea()

            VStack(spacing: VoiSpacing.md) {
                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    Task { await finishAppleSignIn(result) }
                }
                .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .disabled(isSigningIn)
                .accessibilityIdentifier(A11y.Login.apple)

                Button {
                    Task { await signInWithGoogle() }
                } label: {
                    HStack(spacing: VoiSpacing.sm) {
                        GoogleLogo()
                            .frame(width: 18, height: 18)
                        Text("Sign in with Google")
                            .font(.system(size: 17, weight: .medium))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .foregroundStyle(VoiColor.ink)
                    .background(VoiColor.surface, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(VoiColor.line, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(isSigningIn)
                .accessibilityLabel("Sign in with Google")
                .accessibilityIdentifier(A11y.Login.google)

                if UITestLaunch.isEnabled {
                    Button("Sign in for tests") {
                        Task { await signInForTests() }
                    }
                    .font(.subheadline.weight(.semibold))
                    .accessibilityIdentifier(A11y.Login.dev)
                    .disabled(isSigningIn)
                }
            }
            .frame(maxWidth: 360)
            .padding(.horizontal, VoiSpacing.xl)
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

    private func signInForTests() async {
        guard !isSigningIn else { return }
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            let response = try await environment.apiClient.devLogin(
                email: UITestLaunch.email,
                displayName: UITestLaunch.displayName
            )
            environment.authSession.signIn(response: response)
            onLogin()
        } catch {
            if let apiError = error as? APIErrorResponse {
                errorMessage = apiError.error.message
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func finishAppleSignIn(_ result: Result<ASAuthorization, Error>) async {
        guard !isSigningIn else { return }
        switch result {
        case .failure(let error):
            let nsError = error as NSError
            if nsError.domain == ASAuthorizationError.errorDomain,
               nsError.code == ASAuthorizationError.canceled.rawValue {
                return
            }
            errorMessage = error.localizedDescription
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8)
            else {
                errorMessage = "Apple did not return a sign-in token."
                return
            }
            let name = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .joined(separator: " ")
            isSigningIn = true
            defer { isSigningIn = false }
            do {
                let response = try await environment.apiClient.appleLogin(
                    identityToken: identityToken,
                    fullName: name.isEmpty ? nil : name
                )
                environment.authSession.signIn(tokens: response)
                onLogin()
            } catch {
                if let apiError = error as? APIErrorResponse {
                    errorMessage = apiError.error.message
                } else {
                    errorMessage = error.localizedDescription
                }
            }
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
            environment.authSession.signIn(tokens: response)
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
