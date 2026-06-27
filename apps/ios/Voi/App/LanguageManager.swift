import Foundation
import SwiftUI

/// Supported in-app languages. Raw value is the `.lproj` / locale code.
enum AppLanguage: String, CaseIterable, Identifiable {
    case english = "en"
    case vietnamese = "vi"

    var id: String { rawValue }

    /// Native name shown in the picker. These are deliberately NOT localized so
    /// each option always reads in its own language.
    var nativeName: String {
        switch self {
        case .english: "English"
        case .vietnamese: "Tiếng Việt"
        }
    }
}

/// Drives the app's language at runtime. Stores the choice and redirects all
/// localized-string lookups to the chosen `.lproj` bundle so the UI updates
/// live, without an app relaunch.
@MainActor
final class LanguageManager: ObservableObject {
    private static let storageKey = "appLanguage"

    @Published var language: AppLanguage {
        didSet {
            guard oldValue != language else { return }
            UserDefaults.standard.set(language.rawValue, forKey: Self.storageKey)
            Bundle.setAppLanguage(language.rawValue)
        }
    }

    var locale: Locale { Locale(identifier: language.rawValue) }

    init() {
        let stored = UserDefaults.standard.string(forKey: Self.storageKey)
        let initial = stored.flatMap(AppLanguage.init(rawValue:)) ?? .english
        language = initial
        Bundle.setAppLanguage(initial.rawValue)
    }
}

// MARK: - Live bundle swap

// Only its address is used (as an Obj-C associated-object key), never its value.
nonisolated(unsafe) private var languageBundleKey: UInt8 = 0

/// Bundle subclass that resolves localized strings from a per-language bundle
/// when one is set, so changing the language updates `Text("...")` immediately.
private final class LanguageBundle: Bundle, @unchecked Sendable {
    override func localizedString(forKey key: String, value: String?, table tableName: String?) -> String {
        if let bundle = objc_getAssociatedObject(self, &languageBundleKey) as? Bundle {
            return bundle.localizedString(forKey: key, value: value, table: tableName)
        }
        return super.localizedString(forKey: key, value: value, table: tableName)
    }
}

extension Bundle {
    /// Point `Bundle.main`'s localized-string lookups at the given language's
    /// `.lproj`. Swaps the class once, then just updates the associated bundle.
    static func setAppLanguage(_ language: String) {
        if !(Bundle.main is LanguageBundle) {
            object_setClass(Bundle.main, LanguageBundle.self)
        }
        let bundle = Bundle.main.path(forResource: language, ofType: "lproj").flatMap(Bundle.init(path:))
        objc_setAssociatedObject(Bundle.main, &languageBundleKey, bundle, .OBJC_ASSOCIATION_RETAIN)
    }
}

extension Locale {
    /// Locale matching the app's currently selected language, so formatters
    /// (dates, numbers) follow the in-app language choice rather than the device.
    /// Mirrors `LanguageManager.storageKey`.
    static var appLanguage: Locale {
        let code = UserDefaults.standard.string(forKey: "appLanguage") ?? AppLanguage.english.rawValue
        return Locale(identifier: code)
    }
}

// MARK: - Appearance

/// Supported app appearances, mapped to a SwiftUI colour scheme.
enum AppTheme: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    /// `nil` follows the device. Used with `.preferredColorScheme`.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    /// Localised label for the picker.
    var labelKey: LocalizedStringKey {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

/// Drives the app's light/dark appearance at runtime and persists the choice.
@MainActor
final class ThemeManager: ObservableObject {
    private static let storageKey = "appTheme"

    @Published var theme: AppTheme {
        didSet {
            guard oldValue != theme else { return }
            UserDefaults.standard.set(theme.rawValue, forKey: Self.storageKey)
        }
    }

    init() {
        let stored = UserDefaults.standard.string(forKey: Self.storageKey)
        theme = stored.flatMap(AppTheme.init(rawValue:)) ?? .system
    }
}
