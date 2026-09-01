import SwiftUI

struct ProfileView: View {
    @ObservedObject var authSession: AuthSession
    @ObservedObject var sessionsViewModel: HomeViewModel
    let onSignOut: () -> Void
    @EnvironmentObject private var environment: AppEnvironment

    @State private var displayName: String = ""
    @State private var skillLevel: SkillLevel = .intermediate
    @State private var didSave = false
    @State private var saveMessage = ""
    @State private var isSaving = false
    @State private var isCreatingSession = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NavigationLink {
                        PersonDetailView(person: myProfile)
                    } label: {
                        HStack(spacing: VoiSpacing.md) {
                            AvatarView(
                                url: authSession.currentPlayer.displayAvatarUrl,
                                initials: String(displayName.prefix(1)).uppercased(),
                                size: 56
                            )
                            VStack(alignment: .leading, spacing: VoiSpacing.xs) {
                                Text(displayName.isEmpty ? "You" : displayName)
                                    .font(.headline)
                                Text(authSession.currentUser?.email ?? "you@example.com")
                                    .font(.subheadline)
                                    .foregroundStyle(VoiColor.muted)
                            }
                        }
                        .padding(.vertical, VoiSpacing.xs)
                    }
                }

                Section("Events") {
                    Button {
                        isCreatingSession = true
                    } label: {
                        Label("Create event", systemImage: "plus.circle.fill")
                    }
                    .accessibilityIdentifier(A11y.Profile.createEvent)

                    NavigationLink {
                        ManageEventsView(viewModel: sessionsViewModel)
                    } label: {
                        Label("Manage events", systemImage: "slider.horizontal.3")
                    }
                    .accessibilityIdentifier(A11y.Profile.manageEvents)
                }

                Section("Profile") {
                    TextField("Display name", text: $displayName)
                        .accessibilityIdentifier(A11y.Profile.displayName)
                    Picker("Default skill", selection: $skillLevel) {
                        ForEach(SkillLevel.allCases) { level in
                            Text(LocalizedStringKey(level.label)).tag(level)
                        }
                    }
                }

                Section {
                    Button {
                        Task { await saveProfile() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save changes")
                        }
                    }
                    .disabled(trimmedName.isEmpty || isSaving)
                    .accessibilityIdentifier(A11y.Profile.save)
                }

                Section {
                    NavigationLink {
                        SettingsView(onSignOut: onSignOut)
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .accessibilityIdentifier(A11y.Profile.settings)
                }
            }
            .navigationTitle("Profile")
            .onAppear(perform: syncFromSession)
            .sheet(isPresented: $isCreatingSession) {
                CreateSessionView(groupName: sessionsViewModel.activeGroupName) { draft in
                    try await sessionsViewModel.createSession(draft)
                }
            }
            .alert("Profile", isPresented: $didSave) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(saveMessage)
            }
        }
    }

    private func saveProfile() async {
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await authSession.updateProfile(
                displayName: trimmedName,
                skillLevel: skillLevel,
                using: environment.apiClient
            )
            saveMessage = "Your profile was saved."
            didSave = true
        } catch {
            // Offline fallback so the form still feels responsive.
            authSession.updateProfileLocally(displayName: trimmedName, skillLevel: skillLevel)
            saveMessage = "Saved on this device. Could not reach the server."
            didSave = true
        }
    }

    private var trimmedName: String {
        displayName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The current user as a profile, for the "my profile" screen.
    private var myProfile: PersonProfile {
        let joined = sessionsViewModel.sessions.filter { session in
            session.joinedParticipants.contains { $0.player.id == authSession.currentPlayer.id }
        }.count
        return PersonProfile(player: authSession.currentPlayer, role: .player, activityCount: joined, reviews: [])
    }

    private func syncFromSession() {
        let user = authSession.currentUser ?? Mock.currentUserProfile
        displayName = user.displayName
        skillLevel = user.defaultSkillLevel
    }
}

/// Host-facing list of upcoming sessions to open and manage (edit lineup,
/// cost, RSVP) from the session detail screen.
private struct ManageEventsView: View {
    @ObservedObject var viewModel: HomeViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: VoiSpacing.md) {
                if viewModel.upcomingSessions.isEmpty {
                    Text("No upcoming sessions to manage. Create one to get started.")
                        .font(.subheadline)
                        .foregroundStyle(VoiColor.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .voiCard()
                } else {
                    SessionListContent(
                        sessions: viewModel.upcomingSessions,
                        currentPlayer: viewModel.currentPlayer
                    )
                }
            }
            .padding(VoiSpacing.lg)
        }
        .background(VoiColor.background)
        .scrollIndicators(.hidden)
        .navigationTitle("Manage events")
        .navigationBarTitleDisplayMode(.inline)
    }
}
