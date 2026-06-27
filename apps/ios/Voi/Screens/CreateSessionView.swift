import SwiftUI
import PhotosUI

private enum PricingMode: Hashable {
    case fixed
    case split
}

struct CreateSessionView: View {
    @Environment(\.dismiss) private var dismiss

    let groupName: String
    let editingSession: SessionSummary?
    let onSubmit: (CreateSessionDraft) async throws -> Void

    @State private var title: String
    @State private var venueName: String
    @State private var startsAt: Date
    @State private var endsAt: Date
    @State private var courtCount: Int
    @State private var maxPlayers: Int
    @State private var feeTotalVnd: Int
    @State private var shuttlecockCostVnd: Int
    @State private var pricingMode: PricingMode
    @State private var pricePerPlayerVnd: Int
    @State private var skillLevel: SkillLevel
    @State private var repeatsWeekly = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @EnvironmentObject private var environment: AppEnvironment
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var imageUrls: [String] = []
    @State private var isUploadingImage = false

    init(groupName: String, editing: SessionSummary? = nil, onSubmit: @escaping (CreateSessionDraft) async throws -> Void) {
        self.groupName = groupName
        self.editingSession = editing
        self.onSubmit = onSubmit

        _title = State(initialValue: editing?.title ?? "Tuesday Night Badminton")
        _venueName = State(initialValue: editing?.venueName ?? "Ky Hoa Badminton")
        _startsAt = State(initialValue: editing?.startsAt ?? Date())
        _endsAt = State(initialValue: editing?.endsAt ?? Date().addingTimeInterval(60 * 60 * 2))
        _courtCount = State(initialValue: editing?.courtCount ?? 2)
        _maxPlayers = State(initialValue: editing?.maxPlayers ?? 8)
        _feeTotalVnd = State(initialValue: editing?.feeTotalVnd ?? 240_000)
        _shuttlecockCostVnd = State(initialValue: editing?.shuttlecockCostVnd ?? 60_000)
        _skillLevel = State(initialValue: editing?.skillLevel ?? .intermediate)
        if let fixed = editing?.fixedPricePerPlayerVnd {
            _pricingMode = State(initialValue: .fixed)
            _pricePerPlayerVnd = State(initialValue: fixed)
        } else {
            _pricingMode = State(initialValue: editing == nil ? .fixed : .split)
            _pricePerPlayerVnd = State(initialValue: 80_000)
        }
        _imageUrls = State(initialValue: editing?.imageUrls.map(\.absoluteString) ?? [])
    }

    private var isEditing: Bool { editingSession != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(groupName)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(VoiColor.muted)
                }

                Section("Session") {
                    TextField("Title", text: $title)
                    TextField("Venue", text: $venueName)
                    Picker("Level", selection: $skillLevel) {
                        ForEach(SkillLevel.allCases) { level in
                            Text(level.label).tag(level)
                        }
                    }
                }

                Section("Photos") {
                    if !imageUrls.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: VoiSpacing.sm) {
                                ForEach(imageUrls, id: \.self) { urlString in
                                    photoThumb(urlString)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    PhotosPicker(selection: $photoItems, maxSelectionCount: 6, matching: .images) {
                        Label(photosLabel, systemImage: "photo.badge.plus")
                            .foregroundStyle(VoiColor.court)
                    }
                    .buttonStyle(.plain)
                }

                Section("Time") {
                    DatePicker("Starts", selection: $startsAt)
                    DatePicker("Ends", selection: $endsAt)
                    if !isEditing {
                        Toggle("Repeat weekly", isOn: $repeatsWeekly)
                    }
                }

                Section("Capacity") {
                    Stepper("\(courtCount) courts", value: $courtCount, in: 1...8)
                    Stepper("\(maxPlayers) players", value: $maxPlayers, in: minimumPlayerCount...80)
                }

                Section("Cost") {
                    Picker("Pricing", selection: $pricingMode) {
                        Text("Set price").tag(PricingMode.fixed)
                        Text("Split costs").tag(PricingMode.split)
                    }
                    .pickerStyle(.segmented)

                    if pricingMode == .fixed {
                        Stepper("Price/player \(CurrencyFormatter.vnd(pricePerPlayerVnd))", value: $pricePerPlayerVnd, in: 0...2_000_000, step: 5_000)
                    } else {
                        Stepper("Court \(CurrencyFormatter.vnd(feeTotalVnd))", value: $feeTotalVnd, in: 0...5_000_000, step: 10_000)
                        Stepper("Shuttles \(CurrencyFormatter.vnd(shuttlecockCostVnd))", value: $shuttlecockCostVnd, in: 0...2_000_000, step: 10_000)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit session" : "New Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Create") {
                        Task { await submit() }
                    }
                    .disabled(!canSubmit || isSaving)
                }
            }
            .onChange(of: courtCount) { _, newValue in
                maxPlayers = max(maxPlayers, newValue * 4)
            }
            .onChange(of: photoItems) { _, newItems in
                Task { await uploadPhotos(newItems) }
            }
            .alert(
                "Session",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var minimumPlayerCount: Int { courtCount * 4 }

    private var canSubmit: Bool {
        !venueName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && startsAt < endsAt
            && maxPlayers >= minimumPlayerCount
    }

    private func submit() async {
        guard canSubmit else { return }
        isSaving = true
        defer { isSaving = false }

        do {
            try await onSubmit(
                CreateSessionDraft(
                    title: title,
                    venueName: venueName.trimmingCharacters(in: .whitespacesAndNewlines),
                    startsAt: startsAt,
                    endsAt: endsAt,
                    courtCount: courtCount,
                    maxPlayers: maxPlayers,
                    feeTotalVnd: pricingMode == .split ? feeTotalVnd : 0,
                    shuttlecockCostVnd: pricingMode == .split ? shuttlecockCostVnd : 0,
                    skillLevel: skillLevel,
                    fixedPricePerPlayerVnd: pricingMode == .fixed ? pricePerPlayerVnd : nil,
                    repeatsWeekly: repeatsWeekly,
                    imageUrls: imageUrls
                )
            )
            dismiss()
        } catch {
            if let apiError = error as? APIErrorResponse {
                errorMessage = apiError.error.message
            } else {
                errorMessage = "Could not save the session."
            }
        }
    }

    private var photosLabel: String {
        if isUploadingImage { return "Uploading…" }
        return imageUrls.isEmpty ? "Add photos" : "Change photos (\(imageUrls.count)/6)"
    }

    private func photoThumb(_ urlString: String) -> some View {
        AsyncImage(url: URL(string: urlString)) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                Color(.secondarySystemBackground)
            }
        }
        .frame(width: 88, height: 88)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    /// Upload every freshly-picked photo (max 6), then replace the set with the
    /// resulting URLs.
    private func uploadPhotos(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty, let token = environment.authSession.token else { return }

        isUploadingImage = true
        defer { isUploadingImage = false }

        var urls: [String] = []
        for item in items.prefix(6) {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let uiImage = UIImage(data: data),
                  let jpeg = uiImage.jpegData(compressionQuality: 0.8)
            else { continue }
            do {
                let response = try await environment.apiClient.uploadImage(token: token, data: jpeg, mimeType: "image/jpeg")
                urls.append(response.url)
            } catch {
                if let apiError = error as? APIErrorResponse {
                    errorMessage = apiError.error.message
                } else {
                    errorMessage = "Could not upload a photo."
                }
            }
        }

        if !urls.isEmpty {
            imageUrls = urls
        }
    }
}
