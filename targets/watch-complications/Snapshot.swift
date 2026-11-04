import Foundation

private let appGroupId = "group.com.evgenypavlovd.texttocalai"
private let snapshotKey = "watchTodaySnapshot"

// Mirrors targets/watch-app/Snapshot.swift's WatchSnapshot (kept as a
// separate copy since each Xcode target compiles its own source files).
struct ComplicationSnapshot: Codable {
    let calories: Int
    let calorieTarget: Int

    static let empty = ComplicationSnapshot(calories: 0, calorieTarget: 2000)

    var caloriesLeft: Int {
        max(calorieTarget - calories, 0)
    }
}

func loadComplicationSnapshot() -> ComplicationSnapshot {
    guard
        let defaults = UserDefaults(suiteName: appGroupId),
        let data = defaults.data(forKey: snapshotKey)
    else {
        return .empty
    }

    return (try? JSONDecoder().decode(ComplicationSnapshot.self, from: data)) ?? .empty
}
