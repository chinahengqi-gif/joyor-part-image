const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const targetDir = __dirname;
let processedCount = 0;
let errorCount = 0;
let skippedCount = 0;

async function walk(dir) {
    let results = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of list) {
        if (dirent.name === 'node_modules' || dirent.name.startsWith('.')) continue; // ignore node_modules and hidden files like .git
        const file = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            results = results.concat(await walk(file));
        } else {
            results.push(file);
        }
    }
    return results;
}

async function processImages() {
    console.log(`Scanning directory: ${targetDir}`);
    const files = await walk(targetDir);
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    });

    console.log(`Found ${imageFiles.length} images to check/compress. Starting...`);
    let totalSavedBytes = 0;

    for (const file of imageFiles) {
        const ext = path.extname(file).toLowerCase();
        try {
            const buffer = await fs.readFile(file);
            let img = sharp(buffer);
            
            if (ext === '.png') {
                img = img.png({ quality: 80, effort: 8, palette: true });
            } else if (ext === '.jpg' || ext === '.jpeg') {
                img = img.jpeg({ quality: 80, mozjpeg: true });
            } else if (ext === '.webp') {
                img = img.webp({ quality: 80 });
            }

            const outputBuffer = await img.toBuffer();
            
            // Only overwrite if it actually saved space
            if (outputBuffer.length < buffer.length) {
                await fs.writeFile(file, outputBuffer);
                processedCount++;
                const saved = buffer.length - outputBuffer.length;
                totalSavedBytes += saved;
                console.log(`[Compressed] ${path.relative(targetDir, file)} - saved ${(saved / 1024).toFixed(2)} KB`);
            } else {
                skippedCount++;
            }
        } catch (error) {
            console.error(`[Error] processing ${path.relative(targetDir, file)}:`, error.message);
            errorCount++;
        }
    }

    console.log(`\nFinished!`);
    console.log(`Compressed: ${processedCount} images.`);
    console.log(`Skipped (already optimized): ${skippedCount} images.`);
    console.log(`Errors: ${errorCount} images.`);
    console.log(`Total space saved: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);
}

processImages();
