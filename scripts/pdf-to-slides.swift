// Rasterise a PDF into one PNG per page, for public/tailor-studio/slides.
//
//   swift scripts/pdf-to-slides.swift <input.pdf> <output-dir> [width]
//
// macOS only, and deliberately so: PDFKit and CoreGraphics are already on the
// machine, so converting a deck costs nothing to install. Everything else
// that does this job — poppler, mupdf, ghostscript — is a dependency, and the
// alternative to a dependency here is forty lines of Foundation.
//
// Pages come out as 01.png, 02.png, … which is exactly the order the
// slideshow reads. Re-running overwrites; it never renames.
//
// Each page is trimmed to its own content. A deck exported to Letter paper
// puts a 16:9 slide in the middle of a portrait page with white bands above
// and below it; shipping that means every slide on the site is two-thirds
// empty paper. Pass `keep-margins` as a fourth argument to leave them on.
import Foundation
import PDFKit
import AppKit

let arguments = CommandLine.arguments
guard arguments.count >= 3 else {
    FileHandle.standardError.write(
        "usage: swift scripts/pdf-to-slides.swift <input.pdf> <output-dir> [width]\n".data(using: .utf8)!)
    exit(2)
}

let input = URL(fileURLWithPath: arguments[1])
let outputDirectory = URL(fileURLWithPath: arguments[2])
// 2000px wide. A slide never displays above 960 CSS pixels, so this covers a
// 2x display with room to spare, and Next's optimiser resizes from here.
let targetWidth = arguments.count > 3 ? (Double(arguments[3]) ?? 2000) : 2000
let trimMargins = !arguments.contains("keep-margins")

/// The bounding box of everything that is not the paper colour.
///
/// Tolerant by 6/255 per channel, because an "white" page exported from a
/// browser is rarely #ffffff exactly — it carries the renderer's own
/// antialiasing and colour management, and an exact comparison finds content
/// in all four corners and trims nothing.
func contentBounds(of image: CGImage, tolerance: UInt8 = 6) -> CGRect? {
    let width = image.width
    let height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard let context = CGContext(
        data: &pixels, width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    var minX = width, minY = height, maxX = -1, maxY = -1
    let floor = 255 - tolerance
    for y in 0..<height {
        let row = y * width * 4
        for x in 0..<width {
            let i = row + x * 4
            if pixels[i] >= floor && pixels[i + 1] >= floor && pixels[i + 2] >= floor { continue }
            if x < minX { minX = x }
            if x > maxX { maxX = x }
            if y < minY { minY = y }
            if y > maxY { maxY = y }
        }
    }
    guard maxX >= minX, maxY >= minY else { return nil }
    return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
}

guard let document = PDFDocument(url: input) else {
    FileHandle.standardError.write("could not open \(input.path)\n".data(using: .utf8)!)
    exit(1)
}

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    guard bounds.width > 0, bounds.height > 0 else { continue }

    let scale = targetWidth / Double(bounds.width)
    let pixelsWide = Int((Double(bounds.width) * scale).rounded())
    let pixelsHigh = Int((Double(bounds.height) * scale).rounded())

    // An explicit bitmap rep rather than NSImage.lockFocus(): lockFocus sizes
    // itself from the screen's backing scale, so the same command would
    // produce different pixel dimensions on a Retina display and an external
    // monitor.
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelsWide, pixelsHigh: pixelsHigh,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { continue }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let context = NSGraphicsContext.current!.cgContext

    // Slides are drawn on white. Without this the page composites onto
    // transparency and any unpainted area reads as a hole once the site's
    // dark ground shows through it.
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: pixelsWide, height: pixelsHigh))

    context.scaleBy(x: CGFloat(scale), y: CGFloat(scale))
    context.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
    page.draw(with: .mediaBox, to: context)

    NSGraphicsContext.restoreGraphicsState()

    var output: NSBitmapImageRep = rep
    if trimMargins, let full = rep.cgImage, let box = contentBounds(of: full),
       let cropped = full.cropping(to: box) {
        output = NSBitmapImageRep(cgImage: cropped)
    }

    guard let png = output.representation(using: .png, properties: [:]) else { continue }
    let name = String(format: "%02d.png", index + 1)
    try png.write(to: outputDirectory.appendingPathComponent(name))
    let trimmed = output.pixelsWide != pixelsWide || output.pixelsHigh != pixelsHigh
    print("\(name)  \(output.pixelsWide)x\(output.pixelsHigh)"
        + (trimmed ? "  (trimmed from \(pixelsWide)x\(pixelsHigh))" : ""))
}

print("\n\(document.pageCount) page\(document.pageCount == 1 ? "" : "s") -> \(outputDirectory.path)")
