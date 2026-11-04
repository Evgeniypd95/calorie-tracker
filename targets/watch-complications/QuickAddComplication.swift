import WidgetKit
import SwiftUI

private struct QuickAddEntry: TimelineEntry {
    let date: Date
}

private struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry {
        QuickAddEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        completion(Timeline(entries: [QuickAddEntry(date: Date())], policy: .never))
    }
}

private struct QuickAddView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCorner:
            Image(systemName: "plus")
                .font(.system(size: 18, weight: .bold))
                .widgetLabel("Log meal")
        default:
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(Color("primary"))
        }
    }
}

struct QuickAddComplication: Widget {
    let kind = "QuickAddComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { _ in
            QuickAddView()
                .containerBackground(.background, for: .widget)
                // Tapping launches the watch app straight into dictation.
                .widgetURL(URL(string: "texttocalai-watch://log"))
        }
        .configurationDisplayName("Quick Add")
        .description("Tap to log a meal by voice.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryRectangular])
    }
}
