import fs from 'fs';
import path from 'path';
import pngToIco from 'png-to-ico';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');

// Create ICO file from multiple PNG sizes
const createIco = async () => {
    console.log('Creating ICO file...');
    
    const icoPath = path.join(iconsDir, 'icon.ico');
    
    try {
        // Use multiple PNG sizes for a proper ICO file
        const pngPaths = [
            path.join(iconsDir, 'icon-16x16.png'),
            path.join(iconsDir, 'icon-32x32.png'),
            path.join(iconsDir, 'icon-64x64.png'),
            path.join(iconsDir, 'icon-128x128.png')
        ];
        
        // Filter only existing files
        const existingPngs = pngPaths.filter(pngPath => fs.existsSync(pngPath));
        
        if (existingPngs.length === 0) {
            throw new Error('No PNG files found to create ICO');
        }
        
        console.log('Using PNG files:', existingPngs.map(p => path.basename(p)));
        
        // Create proper ICO file with multiple sizes
        const icoBuffer = await pngToIco(existingPngs);
        fs.writeFileSync(icoPath, icoBuffer);
        
        console.log('ICO file created successfully with', existingPngs.length, 'icon sizes!');
    } catch (error) {
        console.error('Error creating ICO file:', error);
    }
};

createIco();