import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

struct LogoCommand: Decodable { let command: String; let values: [Double] }
struct LogoDrawing: Decodable { let width: Double; let height: Double; let paths: [[LogoCommand]] }
typealias TextRaster = (pixels: [UInt8], width: Int, height: Int, advance: Double, centerY: Double, inkHeight: Double)
func measured(_ pixels: [UInt8], _ w: Int, _ h: Int, _ advance: Double) -> TextRaster {
    var low = h, high = 0
    for y in 0..<h { for x in 0..<w { if pixels[(y*w+x)*4+3] > 32 { low=min(low,y);high=max(high,y) } } }
    return (pixels,w,h,advance,Double(low+high)/2,Double(max(1,high-low+1)))
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let fontURL = root.appendingPathComponent("assets/InterVariable.ttf")
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
let width = 2048, height = 2048
let labels = ["Audience Choice", "Innovation Award", "Best Visual", "Best Collaboration", "Best Transformation"]
let slugs = ["lemon", "lime", "cyan", "blue", "magenta"]
let palette: [[UInt8]] = [[239,255,53], [141,255,0], [0,226,250], [18,153,255], [255,0,200]]
let colorSpace = CGColorSpaceCreateDeviceRGB()
func font(_ size: CGFloat, _ weight: Double) -> CTFont {
    let base = CTFontCreateWithName("InterVariable" as CFString, size, nil)
    let descriptor = CTFontDescriptorCreateWithAttributes([kCTFontVariationAttribute: [NSNumber(value: 2003265652): NSNumber(value: weight)]] as CFDictionary)
    return CTFontCreateCopyWithAttributes(base, size, nil, descriptor)
}
func textLine(_ runs: [(String, CGFloat, Double)]) -> TextRaster {
    let w = 1800, h = 180
    var pixels = [UInt8](repeating: 0, count: w*h*4)
    let attributed = NSMutableAttributedString(string: "")
    for (text, size, weight) in runs {
        attributed.append(NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font(size, weight), NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 1, alpha: 1)]))
    }
    let line = CTLineCreateWithAttributedString(attributed)
    let advance = CTLineGetTypographicBounds(line, nil, nil, nil)
    pixels.withUnsafeMutableBytes { bytes in
        let ctx = CGContext(data: bytes.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w*4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setAllowsAntialiasing(true); ctx.setShouldAntialias(true)
        ctx.textPosition = CGPoint(x: 8, y: 45)
        CTLineDraw(line, ctx)
    }
    return measured(pixels, w, h, advance + 16)
}
func save(_ bytes: [UInt8], _ path: String) {
    let data = Data(bytes)
    let provider = CGDataProvider(data: data as CFData)!
    let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width*4, space: colorSpace, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
    let dest = CGImageDestinationCreateWithURL(root.appendingPathComponent(path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, image, nil); CGImageDestinationFinalize(dest)
}
func logoRaster() -> TextRaster {
    let drawing = try! JSONDecoder().decode(LogoDrawing.self, from: Data(contentsOf: root.appendingPathComponent("assets/trophies/award-logo-paths.json")))
    let w = 1088, h = 256
    var pixels = [UInt8](repeating: 0,count:w*h*4)
    pixels.withUnsafeMutableBytes { bytes in
        let ctx = CGContext(data: bytes.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:colorSpace,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.translateBy(x: 8,y: 32+CGFloat(drawing.height)*8)
        ctx.scaleBy(x: 8,y: -8)
        ctx.setFillColor(CGColor(gray:1,alpha:1))
        for commands in drawing.paths {
            let path=CGMutablePath(); var current=CGPoint.zero
            for item in commands {
                let v=item.values
                switch item.command {
                case "M": current=CGPoint(x:v[0],y:v[1]);path.move(to:current)
                case "L": current=CGPoint(x:v[0],y:v[1]);path.addLine(to:current)
                case "H": current.x=v[0];path.addLine(to:current)
                case "V": current.y=v[0];path.addLine(to:current)
                case "C": path.addCurve(to:CGPoint(x:v[4],y:v[5]),control1:CGPoint(x:v[0],y:v[1]),control2:CGPoint(x:v[2],y:v[3]));current=CGPoint(x:v[4],y:v[5])
                case "Z": path.closeSubpath()
                default: break
                }
            }
            ctx.addPath(path);ctx.fillPath()
        }
    }
    return measured(pixels,w,h,Double(w))
}
let logo = logoRaster()
let logoLength = 1.18
// Match the main logo ascenders (not the extra height of the raised 2027).
let matchingLetterHeight = (20.59 - 6.36768) * 8 * logoLength / logo.advance

for index in 0..<5 {
    var mask = [Double](repeating: 0, count: width*height)
    // Vertical reading, bottom to top. The radius correction keeps glyphs the same width up the cone.
    func place(_ source: TextRaster, startY: Double, length: Double, centerOffset: Double = 0) {
        for y in 0..<height {
            let physicalY = (1 - Double(y)/Double(height)) * 5.6
            let s = (physicalY-startY)/length
            if s < 0 || s > 1 { continue }
            let sourceX = Int(s * source.advance)
            if sourceX < 0 || sourceX >= source.width { continue }
            let radius = max(0.026, 0.59*(1-physicalY/5.6))
            for x in 0..<width {
                let wrappedX = Double(x < width/2 ? x : x-width) / Double(width)
                let physicalX = wrappedX * 2 * Double.pi * radius - centerOffset
                let sourceY = Int(source.centerY + physicalX * source.advance / length)
                if sourceY < 0 || sourceY >= source.height { continue }
                mask[y*width+x] = max(mask[y*width+x], Double(source.pixels[(sourceY*source.width+sourceX)*4+3])/255)
            }
        }
    }
    place(logo, startY: 0.20, length: logoLength)
    let award = textLine([(labels[index], 93, 200)])
    place(award, startY: 1.61, length: award.advance * matchingLetterHeight * 0.82 / award.inkHeight)
    var color = [UInt8](repeating: 255, count: width*height*4)
    var normal = [UInt8](repeating: 255, count: width*height*4)
    func m(_ x: Int, _ y: Int) -> Double { mask[max(0,min(height-1,y))*width+(x+width)%width] }
    for y in 0..<height { for x in 0..<width {
        let i=y*width+x, a=mask[i]
        let slopeX = m(x+1,y)-m(x-1,y)
        let slopeY = m(x,y+1)-m(x,y-1)
        // A narrow recessed lip: shaded on one wall, catching light on the other.
        let rim = max(0, max(max(m(x+1,y),m(x-1,y)),max(m(x,y+1),m(x,y-1)))-a)
        let direction = (slopeX+slopeY)*0.5
        for c in 0..<3 {
            let base = Double(palette[index][c])*(1-a)+17*a
            let shadow = base * (1-0.24*max(0,direction)*rim)
            let highlight = (255-base)*0.26*max(0,-direction)*rim
            color[i*4+c] = UInt8(max(0,min(255,shadow+highlight)))
        }
        // Steeper inward normal bevels make the lettering read as incised, not raised.
        let dx = slopeX*1.65
        let dy = slopeY*1.65
        let noise = sin(Double(x)*127.1+Double(y)*311.7)*43758.5453
        let grain = (noise-floor(noise)-0.5)*0.055*(1-a)
        let nx=dx+grain, ny=dy+grain*0.7, nz=1.0
        let len=sqrt(nx*nx+ny*ny+nz*nz)
        normal[i*4] = UInt8(max(0,min(255, (nx/len*0.5+0.5)*255)))
        normal[i*4+1] = UInt8(max(0,min(255, (ny/len*0.5+0.5)*255)))
        normal[i*4+2] = UInt8(max(0,min(255, (nz/len*0.5+0.5)*255)))
    } }
    save(color, "assets/trophies/\(slugs[index])-engraved-color.png")
    save(normal, "assets/trophies/\(slugs[index])-engraved-normal.png")
    print("Rendered \(labels[index])")
}
