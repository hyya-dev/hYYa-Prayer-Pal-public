import SwiftUI

struct ContentView: View {
    @State private var currentPage = 0
    
    var body: some View {
        TabView(selection: $currentPage) {
            PrayerView()
                .tag(0)
            
            CounterView()
                .tag(1)
        }
        .tabViewStyle(.page(indexDisplayMode: .automatic))
    }
}

#Preview {
    ContentView()
}
