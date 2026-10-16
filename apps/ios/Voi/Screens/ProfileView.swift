import SwiftUI
import PhotosUI

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
    @State private var avatarItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: VoiSpacing.md) {
                        PhotosPicker(selection: $avatarItem, matching: .images) {
                            ZStack(alignment: .bottomTrailing) {
                                AvatarView(
                                    url: authSession.currentPlayer.displayAvatarUrl,
                                    initials: String(displayName.prefix(1)).uppercased(),
                                    size: 56
                                )
                                .overlay {
                                    if isUploadingAvatar {
                                        Circle()
                                            .fill(.black.opacity(0.35))
                                        ProgressView().tint(.white)
                                    }
                                }

                                Image(systemName: "camera.fill")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(6)
                                    .background(VoiColor.court, in: Circle())
                                    .offset(x: 2, y: 2)
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(isUploadingAvatar)
                        .accessibilityLabel("Change photo")
                        .accessibilityIdentifier(A11y.Profile.changePhoto)

                        NavigationLink {
                            PersonDetailView(person: myProfile)
                        } label: {
                            VStack(alignment: .leading, spacing: VoiSpacing.xs) {
                                Text(displayName.isEmpty ? "You" : displayName)
                                    .font(.headline)
                                Text(authSession.currentUser?.email ?? "you@example.com")
                                    .font(.subheadline)
                                    .foregroundStyle(VoiColor.muted)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.vertical, VoiSpacing.xs)
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
            .onChange(of: avatarItem) { _, item in
                Task { await uploadAvatar(item) }
            }
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

    private func uploadAvatar(_ item: PhotosPickerItem?) async {
        guard let item, let token = environment.authSession.token else { return }
        isUploadingAvatar = true
        defer { isUploadingAvatar = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let uiImage = UIImage(data: data),
                  let jpeg = uiImage.jpegData(compressionQuality: 0.85)
            else {
                saveMessage = "Could not read that photo."
                didSave = true
                return
            }
            let uploaded = try await environment.apiClient.uploadImage(
                token: token,
                data: jpeg,
                mimeType: "image/jpeg"
            )
            guard let url = URL(string: uploaded.url) else {
                saveMessage = "Could not save the photo."
                didSave = true
                return
            }
            _ = try await authSession.updateAvatar(url, using: environment.apiClient)
        } catch {
            if let apiError = error as? APIErrorResponse {
                saveMessage = apiError.error.message
            } else {
                saveMessage = "Could not upload the photo."
            }
            didSave = true
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
        let hosted = sessionsViewModel.sessions.filter {
            $0.hostUserId == authSession.currentPlayer.id
        }.count
        return PersonProfile(
            player: authSession.currentPlayer,
            isHost: hosted > 0,
            hostedCount: hosted,
            joinedCount: joined,
            reviews: []
        )
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
