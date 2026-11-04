import Foundation
import WatchConnectivity
import WidgetKit

@MainActor
final class WatchSyncManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSyncManager()

    @Published var snapshot: WatchSnapshot = SnapshotStore.load()
    @Published var isReachable = false
    @Published var pendingLogText: String?
    @Published var lastLogResult: QuickLogResult?

    struct QuickLogResult: Identifiable {
        let id = UUID()
        let success: Bool
        let calories: Int?
    }

    private var pendingRequestId: String?

    // The phone might not be reachable, foregrounded, or even running its JS
    // layer to answer at all (e.g. force-quit). Without a timeout a failed
    // round trip leaves the Log screen spinning forever.
    private static let quickLogTimeout: TimeInterval = 20
    private var timeoutTask: Task<Void, Never>?

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: - Sending a quick log up to the phone

    func submitQuickLog(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let requestId = UUID().uuidString
        pendingRequestId = requestId
        pendingLogText = trimmed
        lastLogResult = nil

        let payload: [String: Any] = ["type": "quickLog", "text": trimmed, "requestId": requestId]

        guard WCSession.isSupported() else {
            pendingLogText = nil
            lastLogResult = QuickLogResult(success: false, calories: nil)
            return
        }
        let session = WCSession.default

        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { _ in
                // Phone unreachable mid-send; fall back to a queued transfer
                // rather than giving up (the timeout below still applies).
                session.transferUserInfo(payload)
            }
        } else {
            session.transferUserInfo(payload)
        }

        armTimeout(for: requestId)
    }

    private func armTimeout(for requestId: String) {
        timeoutTask?.cancel()
        timeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(Self.quickLogTimeout * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self, self.pendingRequestId == requestId else { return }
                self.pendingLogText = nil
                self.pendingRequestId = nil
                self.lastLogResult = QuickLogResult(success: false, calories: nil)
            }
        }
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in self.isReachable = session.isReachable }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in self.isReachable = session.isReachable }
    }

    // Phone -> watch, always-latest-wins today snapshot + presets.
    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.handleIncoming(applicationContext) }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in self.handleIncoming(message) }
    }

    private func handleIncoming(_ payload: [String: Any]) {
        if payload["type"] as? String == "quickLogResult" {
            let requestId = payload["requestId"] as? String
            guard requestId == nil || requestId == pendingRequestId else { return }

            timeoutTask?.cancel()
            let success = payload["success"] as? Bool ?? false
            let calories = payload["calories"] as? Int
            lastLogResult = QuickLogResult(success: success, calories: calories)
            pendingLogText = nil
            pendingRequestId = nil
            return
        }

        guard
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let decoded = try? JSONDecoder().decode(WatchSnapshot.self, from: data)
        else { return }

        snapshot = decoded
        SnapshotStore.save(decoded)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
