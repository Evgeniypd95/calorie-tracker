import Foundation

let appGroupId = "group.com.evgenypavlovd.texttocalai"
let snapshotKey = "watchTodaySnapshot"

// Mirrors the payload sent from src/services/widgetService.js via
// updateWatchContext(). Kept separate from the iOS widget's TodaySnapshot
// (targets/widget/widgets.swift) since this one also carries quick-log
// presets that the phone widget has no use for.
struct MealPreset: Codable, Identifiable {
    var id: String { description }
    let description: String
    let mealType: String
    let calories: Int
}

struct WatchSnapshot: Codable {
    let updatedAt: String
    let calories: Int
    let calorieTarget: Int
    let protein: Int
    let proteinTarget: Int
    let carbs: Int
    let carbsTarget: Int
    let fat: Int
    let fatTarget: Int
    let presets: [MealPreset]

    static let empty = WatchSnapshot(
        updatedAt: "",
        calories: 0,
        calorieTarget: 2000,
        protein: 0,
        proteinTarget: 0,
        carbs: 0,
        carbsTarget: 0,
        fat: 0,
        fatTarget: 0,
        presets: []
    )

    var caloriesLeft: Int {
        max(calorieTarget - calories, 0)
    }
}

enum SnapshotStore {
    static func load() -> WatchSnapshot {
        guard
            let defaults = UserDefaults(suiteName: appGroupId),
            let data = defaults.data(forKey: snapshotKey)
        else {
            return .empty
        }

        return (try? JSONDecoder().decode(WatchSnapshot.self, from: data)) ?? .empty
    }

    static func save(_ snapshot: WatchSnapshot) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults.set(data, forKey: snapshotKey)
    }
}
