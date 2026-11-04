import SwiftUI

@main
struct CalAIWatchApp: App {
    @StateObject private var sync = WatchSyncManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sync)
        }
    }
}
