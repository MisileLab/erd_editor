import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'erd-icon.svg');
const iconsDir = path.join(__dirname, 'src-tauri', 'icons');

// Read SVG file
const svgBuffer = fs.readFileSync(svgPath);

// Sizes needed for macOS app
const sizes = [16, 32, 64, 128, 256, 512, 1024];

console.log('Generating icons...');

// Generate PNG files for each size
sizes.forEach(size => {
    const resvg = new Resvg(svgBuffer, {
        width: size,
        height: size,
    });
    
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`Generated: icon-${size}x${size}.png`);
});

// Generate main icon.png (512x512)
const mainResvg = new Resvg(svgBuffer, {
    width: 512,
    height: 512,
});

const mainPngData = mainResvg.render();
const mainPngBuffer = mainPngData.asPng();
const mainIconPath = path.join(iconsDir, 'icon.png');
fs.writeFileSync(mainIconPath, mainPngBuffer);
console.log('Generated: icon.png');

console.log('All icons generated successfully!');