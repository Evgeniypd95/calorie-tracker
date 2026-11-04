import SwiftUI

struct TodayGlanceView: View {
    @EnvironmentObject private var sync: WatchSyncManager

    private var snapshot: WatchSnapshot { sync.snapshot }

    private var progress: CGFloat {
        snapshot.calorieTarget > 0
            ? min(CGFloat(snapshot.calories) / CGFloat(snapshot.calorieTarget), 1.0)
            : 0
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ZStack {
                    Circle()
                        .stroke(Color("primary").opacity(0.15), lineWidth: 9)
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(Color("primary"), style: StrokeStyle(lineWidth: 9, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(snapshot.caloriesLeft)")
                            .font(.system(size: 26, weight: .heavy))
                        Text("left")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 100, height: 100)
                .padding(.top, 4)

                Text("\(snapshot.calories) of \(snapshot.calorieTarget) cal")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)

                HStack(spacing: 10) {
                    MacroPill(label: "P", value: snapshot.protein, color: Color("protein"))
                    MacroPill(label: "C", value: snapshot.carbs, color: Color("carbs"))
                    MacroPill(label: "F", value: snapshot.fat, color: Color("fat"))
                }
                .padding(.top, 2)
            }
            .padding(.bottom, 8)
        }
        .navigationTitle("Today")
    }
}

private struct MacroPill: View {
    let label: String
    let value: Int
    let color: Color

    var body: some View {
        VStack(spacing: 1) {
            Text("\(value)g")
                .font(.system(size: 12, weight: .bold))
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.15), in: Capsule())
    }
}

#Preview {
    TodayGlanceView()
        .environmentObject(WatchSyncManager.shared)
}
