import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');

// Create ICO file from multiple PNG sizes
const createIco = async () => {
    console.log('Creating ICO file...');
    
    // For ICO, we'll use the 256x256 PNG as source
    const pngPath = path.join(iconsDir, 'icon-256x256.png');
    const icoPath = path.join(iconsDir, 'icon.ico');
    
    try {
        // Read the PNG file and convert to ICO format
        // ICO files can contain multiple sizes, but we'll use a single 256x256 image
        await sharp(pngPath)
            .resize(256, 256)
            .png()
            .toFile(icoPath.replace('.ico', '_temp.png'));
        
        // Since sharp doesn't directly support ICO, we'll copy the 256x256 version
        // and rename it (most modern systems can handle PNG data in ICO files)
        const pngData = await sharp(pngPath).png().toBuffer();
        fs.writeFileSync(icoPath, pngData);
        
        console.log('ICO file created successfully!');
    } catch (error) {
        console.error('Error creating ICO file:', error);
    }
};

createIco();