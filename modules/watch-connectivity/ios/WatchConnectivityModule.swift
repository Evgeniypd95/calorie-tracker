import ExpoModulesCore
import WatchConnectivity

// Bridges WCSession to JS on the iPhone side. The watch app's own
// WCSession delegate lives in targets/watch-app and talks to this module
// indirectly via the shared session, not via any shared Swift code.
public class WatchConnectivityModule: Module {
  private let sessionDelegate = SessionDelegate()

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onMessage", "onWatchStateChange")

    OnCreate {
      guard WCSession.isSupported() else { return }
      sessionDelegate.emitter = self
      WCSession.default.delegate = sessionDelegate
      WCSession.default.activate()
    }

    // True only when a paired watch has the companion app installed.
    Property("isWatchAppInstalled") { () -> Bool in
      guard WCSession.isSupported() else { return false }
      return WCSession.default.isWatchAppInstalled
    }

    // Phone -> watch, always-latest-wins. Ideal for "today's totals" since
    // only the newest snapshot matters and delivery isn't guaranteed instantly.
    // NOT suitable for one-off acks (like a quick-log result): a later context
    // update (e.g. the very next snapshot refresh) can silently supersede an
    // earlier one before the watch ever sees it — use sendQuickLogResult for
    // anything that needs to arrive as its own discrete event.
    Function("updateApplicationContext") { (context: [String: Any]) -> Bool in
      guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
        return false
      }
      do {
        try WCSession.default.updateApplicationContext(context)
        return true
      } catch {
        return false
      }
    }

    // Phone -> watch, real-time, for the one-off quick-log ack. Falls back to
    // a queued transfer if the watch isn't reachable right now so the result
    // still arrives once it wakes/reconnects, instead of being lost the way
    // a second updateApplicationContext call would lose it.
    Function("sendQuickLogResult") { (payload: [String: Any]) -> Bool in
      guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
        return false
      }
      let session = WCSession.default
      if session.isReachable {
        session.sendMessage(payload, replyHandler: nil) { _ in
          session.transferUserInfo(payload)
        }
      } else {
        session.transferUserInfo(payload)
      }
      return true
    }
  }

  fileprivate func emit(message: [String: Any]) {
    sendEvent("onMessage", message)
  }

  fileprivate func emitStateChange(reachable: Bool) {
    sendEvent("onWatchStateChange", ["reachable": reachable])
  }
}

private class SessionDelegate: NSObject, WCSessionDelegate {
  weak var emitter: WatchConnectivityModule?

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    emitter?.emitStateChange(reachable: session.isReachable)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate for the next paired watch (e.g. after a watch swap).
    session.activate()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    emitter?.emitStateChange(reachable: session.isReachable)
  }

  // Watch -> phone, sent without a reply handler. The watch uses this path
  // for quick-log requests, so it must be handled separately from the
  // reply-requesting overload below.
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    emitter?.emit(message: message)
  }

  // Watch -> phone messages that explicitly request a reply.
  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    emitter?.emit(message: message)
    replyHandler(["received": true])
  }

  // Watch -> phone, queued delivery for when the phone isn't reachable yet.
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    emitter?.emit(message: userInfo)
  }
}
