import SwiftUI

/// Group chat for a single session: history over REST, live over WebSocket.
struct ChatView: View {
    let sessionId: String
    let sessionTitle: String
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
        .navigationTitle(sessionTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .task {
            viewModel.configure(
                api: environment.apiClient,
                authSession: environment.authSession,
                sessionId: sessionId
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

            Button {
                let text = draft
                draft = ""
                Task { await viewModel.send(text) }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(draft.trimmingCharacters(in: .whitespaces).isEmpty ? VoiColor.muted : VoiColor.court)
            }
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
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
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            if !isMine { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: isMine ? .trailing : .leading)
    }
}
