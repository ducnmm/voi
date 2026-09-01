import SwiftUI

struct SettingsView: View {
    let onSignOut: () -> Void
    @EnvironmentObject private var languageManager: LanguageManager
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var environment: AppEnvironment

    @State private var remindersEnabled = true
    @State private var statusChangesEnabled = true
    @State private var waitlistEnabled = true
    @State private var isLoadingPrefs = false
    @State private var suppressSave = true
    @State private var prefsError: String?
    @State private var confirmDelete = false
    @State private var deleteError: String?

    var body: some View {
        Form {
            Section {
                Toggle("Reminders", isOn: $remindersEnabled)
                    .onChange(of: remindersEnabled) { _, _ in Task { await savePrefsIfReady() } }
                    .accessibilityIdentifier(A11y.Settings.reminders)
                Toggle("Status changes", isOn: $statusChangesEnabled)
                    .onChange(of: statusChangesEnabled) { _, _ in Task { await savePrefsIfReady() } }
                    .accessibilityIdentifier(A11y.Settings.statusChanges)
                Toggle("Waitlist updates", isOn: $waitlistEnabled)
                    .onChange(of: waitlistEnabled) { _, _ in Task { await savePrefsIfReady() } }
                    .accessibilityIdentifier(A11y.Settings.waitlist)
            } header: {
                Text("Notifications")
            } footer: {
                if isLoadingPrefs {
                    Text("Loading preferences…")
                } else if let prefsError {
                    Text(prefsError)
                        .foregroundStyle(.red)
                } else {
                    Text("Synced with your account when online.")
                }
            }

            Section("Appearance") {
                Picker("Appearance", selection: $themeManager.theme) {
                    ForEach(AppTheme.allCases) { theme in
                        Text(theme.labelKey).tag(theme)
                    }
                }
            }

            Section("Language") {
                Picker("Language", selection: $languageManager.language) {
                    ForEach(AppLanguage.allCases) { language in
                        Text(language.nativeName).tag(language)
                    }
                }
            }

            Section("About") {
                HStack {
                    Text("Version")
                    Spacer()
                    Text("0.1.0").foregroundStyle(VoiColor.muted)
                }
            }

            Section {
                Button("Sign out", role: .destructive) { onSignOut() }
                    .accessibilityIdentifier(A11y.Settings.signOut)
                Button("Delete account", role: .destructive) { confirmDelete = true }
                    .accessibilityIdentifier(A11y.Settings.deleteAccount)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadPrefs() }
        .alert("Delete account?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your profile, RSVPs, and messages. If you host a group or session with other people, remove them or cancel those sessions first.")
        }
        .alert("Could not delete account", isPresented: Binding(
            get: { deleteError != nil },
            set: { if !$0 { deleteError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(deleteError ?? "")
        }
    }

    private func deleteAccount() async {
        guard let token = environment.authSession.token else { return }
        do {
            _ = try await environment.apiClient.deleteAccount(token: token)
            onSignOut()
        } catch {
            deleteError = (error as? APIErrorResponse)?.error.message ?? "Please try again."
        }
    }

    private func loadPrefs() async {
        guard let token = environment.authSession.token else {
            suppressSave = false
            return
        }
        isLoadingPrefs = true
        suppressSave = true
        defer {
            isLoadingPrefs = false
            suppressSave = false
        }
        do {
            let response = try await environment.apiClient.fetchNotificationPreferences(token: token)
            remindersEnabled = response.preference.remindersEnabled
            statusChangesEnabled = response.preference.statusChangesEnabled
            waitlistEnabled = response.preference.waitlistEnabled
            prefsError = nil
        } catch {
            prefsError = "Could not load notification preferences."
        }
    }

    private func savePrefsIfReady() async {
        guard !suppressSave, !isLoadingPrefs else { return }
        guard let token = environment.authSession.token else { return }
        do {
            _ = try await environment.apiClient.updateNotificationPreferences(
                token: token,
                request: UpdateNotificationPreferenceRequest(
                    remindersEnabled: remindersEnabled,
                    statusChangesEnabled: statusChangesEnabled,
                    waitlistEnabled: waitlistEnabled,
                    reminderLeadMinutes: nil
                )
            )
            prefsError = nil
        } catch {
            prefsError = "Could not save notification preferences."
        }
    }
}
