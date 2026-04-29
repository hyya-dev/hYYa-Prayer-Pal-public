import SwiftUI
import WatchKit

struct CounterView: View {
    @State private var count = 0
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background image
                Image("WatchBackground")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
                
                VStack(spacing: 0) {
                    Spacer()
                        .frame(height: LayoutConfig.Counter.top)
                    
                    // Counter display
                    Text(String(format: "%03d", count))
                        .font(.system(size: LayoutConfig.Counter.fontSize, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.5), radius: 4, x: 0, y: 2)
                    
                    Spacer()
                        .frame(height: LayoutConfig.Buttons.top - LayoutConfig.Counter.top - LayoutConfig.Counter.fontSize)
                    
                    // Control buttons
                    HStack(spacing: LayoutConfig.Buttons.gap) {
                        // Decrement button
                        Button(action: decrement) {
                            Image(systemName: "minus")
                                .font(.system(size: LayoutConfig.Buttons.size * 0.4, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .frame(width: LayoutConfig.Buttons.size, height: LayoutConfig.Buttons.size)
                        .background(Color.black.opacity(0.4))
                        .clipShape(Circle())
                        .disabled(count == 0)
                        .opacity(count == 0 ? 0.4 : 1)
                        
                        // Reset button
                        Button(action: reset) {
                            Image(systemName: "arrow.counterclockwise")
                                .font(.system(size: LayoutConfig.Buttons.resetSize * 0.35, weight: .medium))
                                .foregroundColor(.white)
                        }
                        .frame(width: LayoutConfig.Buttons.resetSize, height: LayoutConfig.Buttons.resetSize)
                        .background(Color.black.opacity(0.4))
                        .clipShape(Circle())
                        .disabled(count == 0)
                        .opacity(count == 0 ? 0.4 : 1)
                        
                        // Increment button
                        Button(action: increment) {
                            Image(systemName: "plus")
                                .font(.system(size: LayoutConfig.Buttons.size * 0.4, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .frame(width: LayoutConfig.Buttons.size, height: LayoutConfig.Buttons.size)
                        .background(Color.orange.opacity(0.6))
                        .clipShape(Circle())
                        .disabled(count == 999)
                        .opacity(count == 999 ? 0.4 : 1)
                    }
                    
                    Spacer()
                }
            }
        }
        .ignoresSafeArea()
    }
    
    private func increment() {
        guard count < 999 else { return }
        count += 1
        WKInterfaceDevice.current().play(.click)
    }
    
    private func decrement() {
        guard count > 0 else { return }
        count -= 1
        WKInterfaceDevice.current().play(.click)
    }
    
    private func reset() {
        count = 0
        WKInterfaceDevice.current().play(.notification)
    }
}

#Preview {
    CounterView()
}
