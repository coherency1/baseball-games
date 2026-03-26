const fs = require('fs');
const { PNG } = require('pngjs');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error("Usage: node make_transparent.cjs <input> <output>");
  process.exit(1);
}

fs.createReadStream(inputPath)
  .pipe(new PNG())
  .on('parsed', function () {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let idx = (this.width * y + x) << 2;

        let r = this.data[idx];
        let g = this.data[idx + 1];
        let b = this.data[idx + 2];

        // If the pixel is very dark (close to black), make it transparent
        // Since the user wants to remove black
        if (r < 20 && g < 20 && b < 20) {
          this.data[idx + 3] = 0; // alpha = 0
        } else {
            // Apply a simple screen or luma keying method: alpha based on max brightness, or just keep it glowing.
            // Since it's neon, the neon glow has black in it. 
            // A better formula: alpha = max(r, g, b).
            let maxVal = Math.max(r, g, b);
            
            // To prevent making the red too transparent, map the darks to transparent
            // but keep the reds opaque.
            let alpha = Math.min(255, Math.pow(maxVal / 255, 1.5) * 255);
            
            this.data[idx + 3] = alpha;
        }
      }
    }

    this.pack().pipe(fs.createWriteStream(outputPath))
        .on('finish', () => console.log('Image processed:', outputPath));
  });
