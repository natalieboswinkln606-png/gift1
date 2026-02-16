const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function processIcon(inputPath, outputPath) {
  const image = sharp(inputPath)
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })

  // Sample 4 corners (5x5 pixel blocks) to detect background color
  const sampleSize = 5
  const corners = [
    [0, 0],
    [info.width - sampleSize, 0],
    [0, info.height - sampleSize],
    [info.width - sampleSize, info.height - sampleSize],
  ]

  const cornerSamples = corners.map(([cx, cy]) => {
    let r = 0, g = 0, b = 0, count = 0
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        const idx = ((cy + dy) * info.width + (cx + dx)) * 3
        r += data[idx]
        g += data[idx + 1]
        b += data[idx + 2]
        count++
      }
    }
    return [r / count, g / count, b / count]
  })

  // Median of corner samples as background reference
  const sorted = (arr) => [...arr].sort((a, b) => a - b)
  const bgR = sorted(cornerSamples.map((c) => c[0]))[1]
  const bgG = sorted(cornerSamples.map((c) => c[1]))[1]
  const bgB = sorted(cornerSamples.map((c) => c[2]))[1]

  console.log(`  BG color estimate: rgb(${Math.round(bgR)}, ${Math.round(bgG)}, ${Math.round(bgB)})`)

  // Create RGBA buffer with alpha based on color distance from background
  const pixelCount = info.width * info.height
  const rgbaData = Buffer.alloc(pixelCount * 4)
  const threshold = 35
  const softness = 8 // transition range for edge softening

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 3
    const di = i * 4
    const r = data[si]
    const g = data[si + 1]
    const b = data[si + 2]

    // Euclidean distance in RGB space
    const dist = Math.sqrt(
      (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
    )

    let alpha
    if (dist < threshold) {
      alpha = 0
    } else if (dist < threshold + softness) {
      // Smooth transition
      alpha = Math.round(((dist - threshold) / softness) * 255)
    } else {
      alpha = 255
    }

    rgbaData[di] = r
    rgbaData[di + 1] = g
    rgbaData[di + 2] = b
    rgbaData[di + 3] = alpha
  }

  // Write as PNG, then apply slight blur to alpha for edge feathering
  // First write raw RGBA, then re-read and apply median filter for cleaner edges
  const tempPng = await sharp(rgbaData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()

  // Re-read and resize to standardize + slight sharpen for cleaner look
  await sharp(tempPng)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 90 })
    .toFile(outputPath)

  console.log(`  ✓ ${path.basename(inputPath)} → ${path.basename(outputPath)} (256x256)`)
}

async function main() {
  const sourceDir = path.join(__dirname, '..', '图标')
  const outputDir = path.join(__dirname, '..', 'public', 'icons')

  const sourceFiles = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.jpg')).sort()
  console.log(`Found ${sourceFiles.length} source icons\n`)

  for (let i = 0; i < sourceFiles.length; i++) {
    const inputPath = path.join(sourceDir, sourceFiles[i])
    const outputPath = path.join(outputDir, `icon-${String(i + 1).padStart(2, '0')}.png`)
    console.log(`Processing ${sourceFiles[i]}...`)
    await processIcon(inputPath, outputPath)
  }

  console.log(`\n✓ All ${sourceFiles.length} icons processed!`)
}

main().catch(console.error)
