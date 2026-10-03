import CoreLocation
import ImageIO
import UIKit
import UniformTypeIdentifiers

/// A photo ready to identify: downscaled JPEG plus where and when it was taken,
/// read from the original's EXIF before downscaling drops it.
struct PreparedPhoto {
    var jpeg: Data
    var coordinate: CLLocationCoordinate2D?
    var takenAt: Date?
    var gpsFromPhoto: Bool { coordinate != nil }

    var image: UIImage? { UIImage(data: jpeg) }

    /// Long edge capped at 1600px, JPEG 0.85, same as the website's shrinkImage().
    static func from(data: Data, maxEdge: CGFloat = 1600) -> PreparedPhoto? {
        guard let src = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any] ?? [:]
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxEdge,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary),
              let jpeg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.85) else { return nil }
        return PreparedPhoto(jpeg: jpeg, coordinate: gps(props), takenAt: taken(props))
    }

    /// Camera captures carry no GPS; the caller adds the current location.
    static func from(image: UIImage) -> PreparedPhoto? {
        guard let data = image.jpegData(compressionQuality: 0.95) else { return nil }
        var p = from(data: data)
        p?.takenAt = .now
        return p
    }

    static func gps(_ props: [CFString: Any]) -> CLLocationCoordinate2D? {
        guard let g = props[kCGImagePropertyGPSDictionary] as? [CFString: Any],
              var lat = g[kCGImagePropertyGPSLatitude] as? Double,
              var lng = g[kCGImagePropertyGPSLongitude] as? Double else { return nil }
        if (g[kCGImagePropertyGPSLatitudeRef] as? String) == "S" { lat = -lat }
        if (g[kCGImagePropertyGPSLongitudeRef] as? String) == "W" { lng = -lng }
        guard lat.isFinite, lng.isFinite, !(lat == 0 && lng == 0) else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// EXIF DateTimeOriginal is local wall-clock time; OffsetTimeOriginal (when present) pins its zone.
    static func taken(_ props: [CFString: Any]) -> Date? {
        guard let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any],
              let raw = (exif[kCGImagePropertyExifDateTimeOriginal] ?? exif[kCGImagePropertyExifDateTimeDigitized]) as? String
        else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        if let offset = exif[kCGImagePropertyExifOffsetTimeOriginal] as? String {
            f.dateFormat = "yyyy:MM:dd HH:mm:ssxxx"
            if let d = f.date(from: raw + offset) { return d }
        }
        f.dateFormat = "yyyy:MM:dd HH:mm:ss"
        f.timeZone = .current
        return f.date(from: raw)
    }

    /// Decodes the identifier's subject-cropped photo (`data:image/jpeg;base64,…`).
    static func decodeDataURL(_ s: String?) -> Data? {
        guard let s else { return nil }
        let b64 = s.firstIndex(of: ",").map { String(s[s.index(after: $0)...]) } ?? s
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters), !data.isEmpty else { return nil }
        return data
    }
}
