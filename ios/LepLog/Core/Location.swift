import CoreLocation

/// One-shot "where am I" for tagging sightings and the nearby list.
@MainActor
final class Location: NSObject, CLLocationManagerDelegate {
    static let shared = Location()

    private let manager = CLLocationManager()
    private var waiting: [CheckedContinuation<CLLocationCoordinate2D?, Never>] = []
    private var authWaiting: [CheckedContinuation<Void, Never>] = []

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var denied: Bool {
        [.denied, .restricted].contains(manager.authorizationStatus)
    }

    /// Asks for permission the first time; gives up after `timeout` so nothing stalls on it.
    func current(timeout: TimeInterval = 4) async -> CLLocationCoordinate2D? {
        if manager.authorizationStatus == .notDetermined {
            await withCheckedContinuation { c in
                authWaiting.append(c)
                manager.requestWhenInUseAuthorization()
            }
        }
        guard !denied else { return nil }
        if let l = manager.location, l.timestamp.timeIntervalSinceNow > -120 { return l.coordinate }

        return await withCheckedContinuation { c in
            waiting.append(c)
            manager.requestLocation()
            Task {
                try? await Task.sleep(for: .seconds(timeout))
                self.finish(nil)
            }
        }
    }

    private func finish(_ coord: CLLocationCoordinate2D?) {
        let w = waiting
        waiting = []
        w.forEach { $0.resume(returning: coord) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let coord = locations.last?.coordinate
        Task { @MainActor in self.finish(coord) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.finish(nil) }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            guard manager.authorizationStatus != .notDetermined else { return }
            let w = self.authWaiting
            self.authWaiting = []
            w.forEach { $0.resume() }
        }
    }
}
