import WidgetKit
import SwiftUI

private let appGroupId = "group.com.evgenypavlovd.texttocalai"
private let snapshotKey = "todayMealsSnapshot"

// MARK: - Data model (mirrors the JSON written by src/services/widgetService.js)

struct WidgetMeal: Codable, Identifiable {
    let id: String
    let mealType: String
    let description: String
    let calories: Int
}

struct TodaySnapshot: Codable {
    let updatedAt: String
    let meals: [WidgetMeal]
    let calories: Int
    let calorieTarget: Int
    let protein: Int
    let proteinTarget: Int
    let carbs: Int
    let carbsTarget: Int
    let fat: Int
    let fatTarget: Int

    static let empty = TodaySnapshot(
        updatedAt: "",
        meals: [],
        calories: 0,
        calorieTarget: 2000,
        protein: 0,
        proteinTarget: 0,
        carbs: 0,
        carbsTarget: 0,
        fat: 0,
        fatTarget: 0
    )
}

private func loadSnapshot() -> TodaySnapshot {
    guard
        let defaults = UserDefaults(suiteName: appGroupId),
        let data = defaults.data(forKey: snapshotKey)
    else {
        return .empty
    }

    do {
        return try JSONDecoder().decode(TodaySnapshot.self, from: data)
    } catch {
        return .empty
    }
}

// MARK: - Timeline

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: TodaySnapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: Date(), snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let entry = TodayEntry(date: Date(), snapshot: loadSnapshot())
        // The app pushes a fresh snapshot + reloadWidget() every time meals
        // change, so we don't need frequent polling here. This safety-net
        // refresh just guards against a missed reload call (e.g. background
        // termination) by re-reading shared storage once an hour.
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

// MARK: - View helpers

private func mealTypeIcon(_ mealType: String) -> String {
    switch mealType {
    case "Breakfast": return "sunrise.fill"
    case "Lunch": return "sun.max.fill"
    case "Dinner": return "moon.stars.fill"
    case "Snack": return "leaf.fill"
    default: return "fork.knife"
    }
}

private struct MacroBar: View {
    let label: String
    let value: Int
    let target: Int
    let color: Color

    var body: some View {
        let progress = target > 0 ? min(CGFloat(value) / CGFloat(target), 1.0) : 0

        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(value)g")
                    .font(.system(size: 10, weight: .bold))
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(color.opacity(0.15))
                    Capsule().fill(color).frame(width: geo.size.width * progress)
                }
            }
            .frame(height: 5)
        }
    }
}

private struct CalorieRing: View {
    let calories: Int
    let target: Int

    var progress: CGFloat {
        target > 0 ? min(CGFloat(calories) / CGFloat(target), 1.0) : 0
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color("primary").opacity(0.15), lineWidth: 8)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(Color("primary"), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(calories)")
                    .font(.system(size: 20, weight: .heavy))
                Text("of \(target)")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 76, height: 76)
    }
}

private struct MealRow: View {
    let meal: WidgetMeal

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: mealTypeIcon(meal.mealType))
                .font(.system(size: 11))
                .foregroundStyle(Color("primary"))
                .frame(width: 18)
            Text(meal.description)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
            Spacer(minLength: 4)
            Text("\(meal.calories)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Widget view

struct TodayMealsWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        let snapshot = entry.snapshot

        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 10) {
                CalorieRing(calories: snapshot.calories, target: snapshot.calorieTarget)
                VStack(spacing: 6) {
                    MacroBar(label: "P", value: snapshot.protein, target: snapshot.proteinTarget, color: Color("protein"))
                    MacroBar(label: "C", value: snapshot.carbs, target: snapshot.carbsTarget, color: Color("carbs"))
                    MacroBar(label: "F", value: snapshot.fat, target: snapshot.fatTarget, color: Color("fat"))
                }
            }
            .frame(width: 110)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Today")
                        .font(.system(size: 13, weight: .bold))
                    Spacer()
                    Link(destination: URL(string: "texttocalai://log-meal")!) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(Color("primary"))
                    }
                }

                if snapshot.meals.isEmpty {
                    Spacer()
                    Text("No meals logged yet")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(snapshot.meals) { meal in
                            MealRow(meal: meal)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(16)
        .widgetURL(URL(string: "texttocalai://dashboard"))
        .containerBackground(.background, for: .widget)
    }
}

struct TodayMealsWidget: Widget {
    let kind: String = "TodayMealsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TodayMealsWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's Meals")
        .description("See today's logged meals and calorie progress at a glance.")
        .supportedFamilies([.systemMedium])
    }
}

#Preview(as: .systemMedium) {
    TodayMealsWidget()
} timeline: {
    TodayEntry(date: .now, snapshot: TodaySnapshot(
        updatedAt: "",
        meals: [
            WidgetMeal(id: "1", mealType: "Breakfast", description: "Oatmeal with berries", calories: 320),
            WidgetMeal(id: "2", mealType: "Lunch", description: "Chicken salad wrap", calories: 480)
        ],
        calories: 800,
        calorieTarget: 2000,
        protein: 55,
        proteinTarget: 150,
        carbs: 90,
        carbsTarget: 200,
        fat: 25,
        fatTarget: 65
    ))
}
