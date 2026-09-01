import SwiftUI

/// History over REST, live over WebSocket. Same UI for a session or a group.
struct ChatView: View {
    let room: ChatRoom
    @EnvironmentObject private var environment: AppEnvironment
    @StateObject private var viewModel = ChatViewModel()
    @State private var draft = ""

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
        .task {
            viewModel.configure(
                api: environment.apiClient,
                authSession: environment.authSession,
                room: room
            )
            await viewModel.start()
        }
        .onDisappear { viewModel.stop() }
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
