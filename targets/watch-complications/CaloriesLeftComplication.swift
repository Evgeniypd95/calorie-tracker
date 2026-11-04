import WidgetKit
import SwiftUI

private struct CaloriesEntry: TimelineEntry {
    let date: Date
    let snapshot: ComplicationSnapshot
}

private struct CaloriesProvider: TimelineProvider {
    func placeholder(in context: Context) -> CaloriesEntry {
        CaloriesEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (CaloriesEntry) -> Void) {
        completion(CaloriesEntry(date: Date(), snapshot: loadComplicationSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CaloriesEntry>) -> Void) {
        let entry = CaloriesEntry(date: Date(), snapshot: loadComplicationSnapshot())
        // The watch app reloads this timeline immediately whenever a new
        // snapshot arrives over WatchConnectivity; this is just a safety
        // net for missed reloads.
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

private struct CaloriesLeftView: View {
    @Environment(\.widgetFamily) private var family
    let snapshot: ComplicationSnapshot

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(snapshot.calories), in: 0...Double(max(snapshot.calorieTarget, 1))) {
                Text("Cal")
            } currentValueLabel: {
                Text("\(snapshot.caloriesLeft)")
                    .font(.system(size: 15, weight: .bold))
            }
            .gaugeStyle(.accessoryCircular)
            .tint(Color("primary"))

        case .accessoryCorner:
            Text("\(snapshot.caloriesLeft)")
                .font(.system(size: 20, weight: .bold))
                .widgetLabel {
                    Gauge(value: Double(snapshot.calories), in: 0...Double(max(snapshot.calorieTarget, 1))) {
                        EmptyView()
                    }
                    .gaugeStyle(.accessoryLinearCapacity)
                    .tint(Color("primary"))
                }

        default:
            HStack(spacing: 4) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(Color("primary"))
                Text("\(snapshot.caloriesLeft) left")
                    .font(.system(size: 13, weight: .semibold))
            }
        }
    }
}

struct CaloriesLeftComplication: Widget {
    let kind = "CaloriesLeftComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CaloriesProvider()) { entry in
            CaloriesLeftView(snapshot: entry.snapshot)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Calories Left")
        .description("Calories remaining today.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryRectangular])
    }
}
