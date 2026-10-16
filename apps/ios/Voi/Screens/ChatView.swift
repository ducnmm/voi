import SwiftUI

/// History over REST, live over WebSocket. Same UI for a session or a group.
struct ChatView: View {
    let room: ChatRoom
    @EnvironmentObject private var environment: AppEnvironment
    @EnvironmentObject private var store: DemoStore
    @StateObject private var viewModel = ChatViewModel()
    @State private var draft = ""
    @State private var sharePayload: InviteSharePayload?
    @State private var shareError: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: VoiSpacing.md) {
                        ForEach(viewModel.messages) { message in
                            ChatBubble(message: message, isMine: message.author.id == viewModel.myId)
                                .id(message.id)
                        }
                    }
                    .padding(VoiSpacing.lg)
                }
                .onChange(of: viewModel.messages.count) { _, _ in
                    if let last = viewModel.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            inputBar
        }
        .background(VoiColor.background)
        .accessibilityIdentifier(A11y.Chat.screen)
        .navigationTitle(room.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            if case .group(let groupId, let title) = room {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await shareGroupInvite(groupId: groupId, name: title) }
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel("Invite to group")
                    .accessibilityIdentifier(A11y.Share.group)
                }
            }
        }
        .sheet(item: $sharePayload) { payload in
            InviteShareView(title: payload.title, detail: payload.detail, url: payload.url)
        }
        .alert("Could not create invite", isPresented: Binding(
            get: { shareError != nil },
            set: { if !$0 { shareError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(shareError ?? "")
        }
        .task {
            viewModel.configure(
                api: environment.apiClient,
                authSession: environment.authSession,
                room: room
            )
            store.markChatRead(room.id)
            await viewModel.start()
            await store.refreshBadges(
                api: environment.apiClient,
                token: environment.authSession.token
            )
        }
        .onDisappear { viewModel.stop() }
    }

    private func shareGroupInvite(groupId: String, name: String) async {
        guard let token = environment.authSession.token else { return }
        do {
            let response = try await environment.apiClient.createGroupInvite(
                token: token,
                groupId: groupId
            )
            let url = URL(string: response.invite.inviteUrl)
                ?? VoiDeepLink.joinGroup(token: response.invite.token).url
            sharePayload = InviteSharePayload(
                title: "Join \(name)",
                detail: "Scan or tap the link to join this group.",
                url: url
            )
        } catch {
            shareError = (error as? APIErrorResponse)?.error.message
                ?? "Only a group host can share this invite."
        }
    }

    private var inputBar: some View {
        HStack(spacing: VoiSpacing.sm) {
            TextField("Message", text: $draft, axis: .vertical)
                .font(.body)
                .lineLimit(1...5)
                .padding(.horizontal, VoiSpacing.lg)
                .padding(.vertical, VoiSpacing.md)
                .background(VoiColor.surface, in: Capsule())
                .overlay(Capsule().stroke(VoiColor.line, lineWidth: 1))
                .accessibilityIdentifier(A11y.Chat.input)

            Button {
                let text = draft
                Task {
                    let sent = await viewModel.send(text)
                    if sent {
                        draft = ""
                        store.markChatRead(room.id)
                    }
                }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(draft.trimmingCharacters(in: .whitespaces).isEmpty ? VoiColor.muted : VoiColor.court)
            }
            .accessibilityIdentifier(A11y.Chat.send)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, VoiSpacing.lg)
        .padding(.vertical, VoiSpacing.md)
        .background(.bar)
    }
}

private struct ChatBubble: View {
    let message: ChatMessage
    let isMine: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: VoiSpacing.sm) {
            if isMine { Spacer(minLength: 40) }
            if !isMine {
                AvatarView(url: message.author.displayAvatarUrl, initials: message.author.initials, size: 34)
            }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 3) {
                if !isMine {
                    Text(message.author.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(VoiColor.muted)
                }
                Text(message.text)
                    .font(.body)
                    .foregroundStyle(isMine ? Color.white : VoiColor.ink)
                    .padding(.horizontal, VoiSpacing.md)
                    .padding(.vertical, 10)
                    .background(isMine ? VoiColor.court : VoiColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: VoiRadius.message, style: .continuous))
            }
            if !isMine { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: isMine ? .trailing : .leading)
    }
}
