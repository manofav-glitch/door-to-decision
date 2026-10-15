// Reads the text of a PDF (including scanned pages) with macOS PDFKit + Vision, page by page.
// Used to read the owner's study notes in the git-ignored notes/ folder; macOS only, no dependencies.
//   swiftc -O scripts/pdfocr.swift -o /tmp/pdfocr && /tmp/pdfocr notes/htn.pdf > htn.txt
import AppKit
import Foundation
import PDFKit
import Vision

let args = CommandLine.arguments
guard args.count == 2, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  print("usage: pdfocr file.pdf")
  exit(1)
}
for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2.5
  let w = Int(bounds.width * scale), h = Int(bounds.height * scale)
  guard
    let ctx = CGContext(
      data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
  else { continue }
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  ctx.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx)
  guard let img = ctx.makeImage() else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = true
  try? VNImageRequestHandler(cgImage: img).perform([req])
  print("=== page \(i + 1) ===")
  for obs in req.results ?? [] { if let t = obs.topCandidates(1).first { print(t.string) } }
}
