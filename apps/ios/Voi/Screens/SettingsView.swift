import SwiftUI

struct SettingsView: View {
    let onSignOut: () -> Void
    @EnvironmentObject private var languageManager: LanguageManager
    @EnvironmentObject private var themeManager: ThemeManager
    @AppStorage("notifyReminders") private var notifyReminders = true
    @AppStorage("notifyPayments") private var notifyPayments = true
    @AppStorage("notifyRsvp") private var notifyRsvp = true

    var body: some View {
        Form {
            Section("Notifications") {
                Toggle("Reminders", isOn: $notifyReminders)
                Toggle("Payments", isOn: $notifyPayments)
                Toggle("RSVP updates", isOn: $notifyRsvp)
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
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
