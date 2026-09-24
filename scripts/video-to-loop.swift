// Turn a phone clip into something a web page can loop, and pull a poster
// frame out of it.
//
//   swift scripts/video-to-loop.swift <in.mp4> <out.mp4> <poster.jpg> [kbps]
//
// macOS only, and installs nothing: AVFoundation is already on the machine.
//
// Four things happen, and each is the difference between a clip you can put
// on a page and one you cannot:
//
//   1. The audio track is dropped. These loop silently and autoplay — no
//      browser autoplays sound anyway — so the audio is pure weight, and it
//      is also whatever was being said around the camera, which is nobody's
//      business.
//   2. It is scaled to fit 540x960. A photograph never opens wider than ~640
//      CSS pixels in the pond, so 1080x1920 is four times what can be seen.
//   3. Frame rate is halved to 30.
//   4. The bitrate is set explicitly.
//
// Point 4 is why this uses AVAssetWriter rather than the two lines of
// AVAssetExportSession it looks like it wants to be. The export presets have
// no bitrate control: the same clip came out at 540x960 and still 4.8Mbps,
// which is 5.7MB for ten seconds of something that plays in a 300px box.
import Foundation
import AVFoundation
import AppKit

let arguments = CommandLine.arguments
guard arguments.count >= 4 else {
    FileHandle.standardError.write(
        "usage: swift scripts/video-to-loop.swift <in.mp4> <out.mp4> <poster.jpg> [kbps]\n"
            .data(using: .utf8)!)
    exit(2)
}

let input = URL(fileURLWithPath: arguments[1])
let output = URL(fileURLWithPath: arguments[2])
let poster = URL(fileURLWithPath: arguments[3])
let bitrate = (arguments.count > 4 ? Int(arguments[4]) : nil) ?? 900

// Refuse to write over the source. This is not hypothetical: the first run of
// this pipeline transcoded three clips into a scratch folder and then copied
// them back over the originals, which destroyed 27MB of 1080p60 footage and
// with it the only copy of each clip's real creation date. Transcode to a
// scratch directory, check the result, and move it into place deliberately.
if input.standardizedFileURL == output.standardizedFileURL {
    FileHandle.standardError.write(
        "refusing to overwrite the source: \(input.path)\n".data(using: .utf8)!)
    exit(2)
}

let semaphore = DispatchSemaphore(value: 0)

Task {
    do {
        let asset = AVURLAsset(url: input)
        let duration = try await asset.load(.duration)
        guard let source = try await asset.loadTracks(withMediaType: .video).first else {
            throw NSError(domain: "video-to-loop", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "no video track"])
        }

        let naturalSize = try await source.load(.naturalSize)
        let preferredTransform = try await source.load(.preferredTransform)
        let displayed = naturalSize.applying(preferredTransform)
        let displayWidth = abs(displayed.width)
        let displayHeight = abs(displayed.height)
        let scale = min(1, min(540 / displayWidth, 960 / displayHeight))
        // Even numbers: h.264 works in 16x16 macroblocks and an odd dimension
        // makes the encoder pad, which shows up as a seam down one edge.
        let renderSize = CGSize(width: (displayWidth * scale / 2).rounded() * 2,
                                height: (displayHeight * scale / 2).rounded() * 2)

        // --- read, rotated upright and resampled to 30fps ---
        let composition = AVMutableVideoComposition()
        composition.renderSize = renderSize
        composition.frameDuration = CMTime(value: 1, timescale: 30)
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
        let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: source)
        // The scale has to come after the rotation, so that it applies to the
        // rotated result and to the translation the rotation introduces.
        layer.setTransform(
            preferredTransform.concatenating(CGAffineTransform(scaleX: scale, y: scale)),
            at: .zero)
        instruction.layerInstructions = [layer]
        composition.instructions = [instruction]

        let reader = try AVAssetReader(asset: asset)
        let readerOutput = AVAssetReaderVideoCompositionOutput(
            videoTracks: [source],
            videoSettings: [kCVPixelBufferPixelFormatTypeKey as String:
                                kCVPixelFormatType_32BGRA])
        readerOutput.videoComposition = composition
        reader.add(readerOutput)

        // --- write, at a bitrate chosen rather than inherited ---
        try? FileManager.default.removeItem(at: output)
        let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
        let writerInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(renderSize.width),
            AVVideoHeightKey: Int(renderSize.height),
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: bitrate * 1000,
                // A keyframe every two seconds. These loop, so the player
                // seeks back to zero constantly and a sparse keyframe
                // interval makes that seek visibly stutter.
                AVVideoMaxKeyFrameIntervalKey: 60,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                AVVideoAllowFrameReorderingKey: true,
            ],
        ])
        writerInput.expectsMediaDataInRealTime = false
        writer.add(writerInput)
        // Puts the index at the front so playback can start before the whole
        // file has arrived.
        writer.shouldOptimizeForNetworkUse = true

        guard reader.startReading(), writer.startWriting() else {
            throw reader.error ?? writer.error ?? NSError(
                domain: "video-to-loop", code: 2,
                userInfo: [NSLocalizedDescriptionKey: "could not start"])
        }
        writer.startSession(atSourceTime: .zero)

        let queue = DispatchQueue(label: "video-to-loop")
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            writerInput.requestMediaDataWhenReady(on: queue) {
                while writerInput.isReadyForMoreMediaData {
                    guard let buffer = readerOutput.copyNextSampleBuffer() else {
                        writerInput.markAsFinished()
                        continuation.resume()
                        return
                    }
                    writerInput.append(buffer)
                }
            }
        }
        await writer.finishWriting()
        if writer.status != .completed {
            throw writer.error ?? NSError(domain: "video-to-loop", code: 3,
                userInfo: [NSLocalizedDescriptionKey: "write failed"])
        }

        // --- poster frame ---
        // A beat in rather than at zero: the first frame of a phone clip is
        // often still exposing and comes out dark.
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 1280, height: 1280)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 4)
        let (image, _) = try await generator.image(
            at: min(CMTime(value: 1, timescale: 4), duration))
        let rep = NSBitmapImageRep(cgImage: image)
        guard let jpeg = rep.representation(
            using: .jpeg, properties: [.compressionFactor: 0.82]) else {
            throw NSError(domain: "video-to-loop", code: 4,
                          userInfo: [NSLocalizedDescriptionKey: "could not encode poster"])
        }
        try FileManager.default.createDirectory(
            at: poster.deletingLastPathComponent(), withIntermediateDirectories: true)
        try jpeg.write(to: poster)

        let bytes = ((try? FileManager.default.attributesOfItem(
            atPath: output.path)[.size]) as? Int) ?? 0
        print("\(input.lastPathComponent) -> \(Int(renderSize.width))x\(Int(renderSize.height))"
            + " 30fps \(bitrate)kbps  \(String(format: "%.2f", Double(bytes) / 1_048_576))MB"
            + "  poster \(rep.pixelsWide)x\(rep.pixelsHigh)")
    } catch {
        FileHandle.standardError.write("\(input.lastPathComponent): \(error)\n".data(using: .utf8)!)
        exit(1)
    }
    semaphore.signal()
}
semaphore.wait()
