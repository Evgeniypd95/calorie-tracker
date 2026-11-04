import SwiftUI

struct LogView: View {
    @EnvironmentObject private var sync: WatchSyncManager
    @Binding var autoPresentDictation: Bool
    @State private var isDictating = false

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Button(action: startDictation) {
                    Label("Log meal", systemImage: "mic.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color("primary"))
                .disabled(sync.pendingLogText != nil)

                if let pending = sync.pendingLogText {
                    HStack(spacing: 6) {
                        ProgressView()
                        Text(pending)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .padding(.top, 2)
                } else if let result = sync.lastLogResult {
                    ResultBanner(result: result)
                }

                if !sync.snapshot.presets.isEmpty {
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
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Log")
        .onAppear {
            if autoPresentDictation {
                autoPresentDictation = false
                startDictation()
            }
        }
    }

    private func startDictation() {
        isDictating = true
        // Presented via a system dictation input; wired up through
        // WKExtension's presentTextInputController on watchOS, which returns
        // free-form dictated text without needing our own UI for it.
        presentDictation { text in
            isDictating = false
            guard let text, !text.isEmpty else { return }
            sync.submitQuickLog(text)
        }
    }
}

private struct ResultBanner: View {
    let result: WatchSyncManager.QuickLogResult

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: result.success ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(result.success ? Color("primary") : .orange)
            Text(result.success ? "Logged \(result.calories ?? 0) cal" : "Couldn't log that")
                .font(.system(size: 12, weight: .medium))
        }
        .padding(.top, 2)
    }
}
