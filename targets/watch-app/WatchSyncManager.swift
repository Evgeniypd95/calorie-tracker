import Foundation
import WatchConnectivity
import WidgetKit

@MainActor
final class WatchSyncManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSyncManager()

    @Published var snapshot: WatchSnapshot = SnapshotStore.load()
    @Published var isReachable = false
    @Published var pendingLogText: String?
    @Published var pendingLogStatus: QuickLogStatus?
    @Published var lastLogResult: QuickLogResult?

    enum QuickLogStatus: Equatable {
        case sending
        case waitingForPhone
        case processing
    }

    struct QuickLogResult: Identifiable {
        let id = UUID()
        let requestId: String
        let success: Bool
        let calories: Int?
        let reason: String?
    }

    private var pendingRequestId: String?

    // The phone might not be reachable, foregrounded, or even running its JS
    // layer to answer at all (e.g. force-quit). Without a timeout a failed
    // round trip leaves the Log screen spinning forever.
    private static let quickLogTimeout: TimeInterval = 90
    private var timeoutTask: Task<Void, Never>?

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: - Sending a quick log up to the phone

    func submitQuickLog(_ text: String, requestId: String = UUID().uuidString) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        pendingRequestId = requestId
        pendingLogText = trimmed
        pendingLogStatus = .sending
        lastLogResult = nil

        let payload: [String: Any] = [
            "type": "quickLog",
            "text": trimmed,
            "requestId": requestId
        ]
        let session = WCSession.default

        guard WCSession.isSupported(), session.activationState == .activated else {
            pendingLogText = nil
            pendingLogStatus = nil
            pendingRequestId = nil
            lastLogResult = QuickLogResult(requestId: requestId, success: false, calories: nil, reason: "unavailable")
            return
        }

        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { _ in
                // Phone unreachable mid-send; fall back to a queued transfer
                // rather than giving up (the timeout below still applies).
                session.transferUserInfo(payload)
                Task { @MainActor [weak self] in
                    guard let self, self.pendingRequestId == requestId else { return }
                    self.pendingLogStatus = .waitingForPhone
                }
            }
        } else {
            pendingLogStatus = .waitingForPhone
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
                self.pendingLogStatus = nil
                self.pendingRequestId = nil
                self.lastLogResult = QuickLogResult(requestId: requestId, success: false, calories: nil, reason: "timeout")
            }
        }
    }

    func clearLastLogResult() {
        lastLogResult = nil
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
            guard
                let requestId,
                requestId == pendingRequestId || requestId == lastLogResult?.requestId
            else { return }

            if payload["status"] as? String == "processing" {
                guard requestId == pendingRequestId else { return }
                pendingLogStatus = .processing
                armTimeout(for: requestId)
                return
            }

            timeoutTask?.cancel()
            let success = payload["success"] as? Bool ?? false
            let calories = payload["calories"] as? Int
            let reason = payload["reason"] as? String
            lastLogResult = QuickLogResult(requestId: requestId, success: success, calories: calories, reason: reason)
            if requestId == pendingRequestId {
                pendingLogText = nil
                pendingLogStatus = nil
                pendingRequestId = nil
            }
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
