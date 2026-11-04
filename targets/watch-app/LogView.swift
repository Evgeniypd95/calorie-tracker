import SwiftUI

struct LogView: View {
    @EnvironmentObject private var sync: WatchSyncManager
    @State private var mealText = ""
    @State private var requestId = UUID().uuidString
    @State private var showEmptyInputMessage = false

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                if let pending = sync.pendingLogText {
                    VStack(spacing: 6) {
                        ProgressView()
                        Text(pendingStatusMessage)
                            .font(.system(size: 12, weight: .semibold))
                        Text(pending)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(3)
                    }
                    .padding(.vertical, 4)
                } else if !mealText.isEmpty {
                    transcriptReview
                } else {
                    dictationButton
                    Text("Tap to dictate or type what you ate. Review it before logging.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    if showEmptyInputMessage {
                        Text("No words came through. Try dictating again.")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.orange)
                    }
                }

                if let result = sync.lastLogResult {
                    ResultBanner(result: result)
                }

                if !sync.snapshot.presets.isEmpty {
                    recentMeals
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Log")
        .onChange(of: sync.lastLogResult?.id) { _, _ in
            guard sync.lastLogResult?.success == true else { return }
            mealText = ""
            requestId = UUID().uuidString
        }
    }

    private var dictationButton: some View {
        TextFieldLink(
            prompt: Text("For example: eggs and toast"),
            label: {
                Label("Dictate food", systemImage: "mic.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
            },
            onSubmit: acceptTranscript
        )
        .buttonStyle(.borderedProminent)
        .tint(Color("primary"))
        .disabled(sync.pendingLogText != nil)
    }

    private var pendingStatusMessage: String {
        switch sync.pendingLogStatus {
        case .waitingForPhone: return "Waiting for iPhone…"
        case .processing: return "Checking your meal…"
        default: return "Sending to iPhone…"
        }
    }

    private var transcriptReview: some View {
        VStack(spacing: 8) {
            Text("Check this meal")
                .font(.system(size: 13, weight: .semibold))

            Text(mealText)
                .font(.system(size: 12))
                .multilineTextAlignment(.center)
                .lineLimit(4)
                .frame(maxWidth: .infinity)

            Button {
                sync.submitQuickLog(mealText, requestId: requestId)
            } label: {
                Label("Log this meal", systemImage: "checkmark")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color("primary"))
            .disabled(sync.pendingLogText != nil)

            TextFieldLink(
                prompt: Text("Correct the food or amount"),
                label: {
                    Label("Edit words", systemImage: "pencil")
                        .font(.system(size: 12, weight: .medium))
                },
                onSubmit: acceptTranscript
            )
            .disabled(sync.pendingLogText != nil)

            TextFieldLink(
                prompt: Text("Dictate what you ate"),
                label: {
                    Label("Dictate again", systemImage: "mic")
                        .font(.system(size: 12, weight: .medium))
                },
                onSubmit: acceptTranscript
            )
            .disabled(sync.pendingLogText != nil)
        }
    }

    private var recentMeals: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Recent")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .padding(.top, 6)

            ForEach(sync.snapshot.presets) { preset in
                Button {
                    sync.submitQuickLog(preset.description)
                } label: {
                    HStack {
                        Text(preset.description)
                            .font(.system(size: 13))
                            .lineLimit(1)
                        Spacer()
                        Text("\(preset.calories)")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                }
                .disabled(sync.pendingLogText != nil)
            }
        }
    }

    private func acceptTranscript(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        showEmptyInputMessage = trimmed.isEmpty
        guard !trimmed.isEmpty else { return }

        mealText = trimmed
        sync.clearLastLogResult()
    }
}

private struct ResultBanner: View {
    let result: WatchSyncManager.QuickLogResult

    private var message: String {
        if result.success {
            return "Logged \(result.calories ?? 0) cal"
        }

        switch result.reason {
        case .some("unrecognized"): return "Couldn't identify that meal. Edit the words and try again."
        case .some("timeout"): return "No response from iPhone. Open the iPhone app, then retry."
        default: return "Couldn't log it. Check the connection and try again."
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: result.success ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(result.success ? Color("primary") : .orange)
            Text(message)
                .font(.system(size: 11, weight: .medium))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 2)
    }
}
