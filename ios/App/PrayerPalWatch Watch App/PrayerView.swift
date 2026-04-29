import SwiftUI

struct PrayerView: View {
    @ObservedObject private var sessionManager = WatchSessionManager.shared
    
    // Fallback data shown until real data arrives
    private var displayPrayerTimes: [(name: String, time: String)] {
        if sessionManager.prayerTimes.isEmpty {
            let keys = ["fajr", "shurooq", "dhuhr", "asr", "maghrib", "isha"]
            return keys.map { key in
                (sessionManager.prayerName(for: key), "--:--")
            }
        }
        return sessionManager.prayerTimes
    }
    
    private var displayTemperature: String {
        sessionManager.temperature
    }

    private var nextPrayerIndex: Int {
        sessionManager.nextPrayerIndex
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background image
                Image("WatchBackground")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()

                if sessionManager.isWaitingForPhone && sessionManager.prayerTimes.isEmpty {
                    VStack {
                        Text(sessionManager.localizedStrings.waitingForPhone)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.vertical, 6)
                            .padding(.horizontal, 10)
                            .background(Color.black.opacity(0.45))
                            .cornerRadius(8)
                        Spacer()
                    }
                    .padding(.top, 10)
                }
                
                VStack(spacing: 0) {
                    // Temperature - positioned at top left
                    HStack {
                        Text(displayTemperature)
                            .font(.system(size: LayoutConfig.Temperature.fontSize, weight: .bold))
                            .foregroundColor(.white)
                            .shadow(color: .black.opacity(0.5), radius: 2, x: 0, y: 1)
                        Spacer()
                    }
                    .padding(.top, LayoutConfig.Temperature.top)
                    .padding(.leading, 16)
                    
                    Spacer()
                    
                    // Prayer times list
                    VStack(spacing: LayoutConfig.PrayerTimes.gap) {
                        ForEach(Array(displayPrayerTimes.enumerated()), id: \.offset) { index, prayer in
                            HStack {
                                Text(prayer.name)
                                    .font(.system(size: LayoutConfig.PrayerTimes.fontSize, weight: .medium))
                                Spacer()
                                Text(sessionManager.formatTimeForDisplay(at: index))
                                    .font(.system(size: LayoutConfig.PrayerTimes.fontSize, weight: .bold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, index == nextPrayerIndex ? 2 : 0)
                            .background(
                                index == nextPrayerIndex 
                                    ? Color.orange.opacity(0.4) 
                                    : Color.clear
                            )
                            .cornerRadius(4)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 20)
                }
            }
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.2), value: displayTemperature)
    }
}

#Preview {
    PrayerView()
}
