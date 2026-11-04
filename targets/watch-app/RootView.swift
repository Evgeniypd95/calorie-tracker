import SwiftUI

struct RootView: View {
    @EnvironmentObject private var sync: WatchSyncManager
    @State private var selectedTab = 0
    @State private var presentDictationOnLaunch = false

    var body: some View {
        TabView(selection: $selectedTab) {
            TodayGlanceView()
                .tag(0)
            LogView(autoPresentDictation: $presentDictationOnLaunch)
                .tag(1)
        }
        .onOpenURL { url in
            // Complication "quick add" deep link: texttocalai-watch://log
            if url.host == "log" {
                selectedTab = 1
                presentDictationOnLaunch = true
            }
        }
    }
}
