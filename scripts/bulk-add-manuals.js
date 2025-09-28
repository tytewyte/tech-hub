const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const manualsDir = path.join(__dirname, '..', 'public', 'manuals');
const manualsJsonPath = path.join(__dirname, '..', 'public', 'sample-manuals.json');

function generateMetadata(filename) {
    // Remove file extension and Z-Library suffix
    let cleanName = filename.replace(/\s*\(Z-Library\)\.\w+$/, '');

    // Extract author if present
    const authorMatch = cleanName.match(/\(([^)]+)\)/);
    let author = '';
    if (authorMatch) {
        author = authorMatch[1];
        cleanName = cleanName.replace(/\s*\([^)]+\)/, '').trim();
    }

    const title = cleanName;
    let category = 'technical-guides';
    let subcategory = 'General';
    const description = `A manual titled '${title}'${author ? ` by ${author}` : ''}.`;

    if (filename.toLowerCase().includes('troubleshooting')) {
        subcategory = 'Troubleshooting';
    } else if (filename.toLowerCase().includes('electric')) {
        subcategory = 'Electrical';
    } else if (filename.toLowerCase().includes('control')) {
        subcategory = 'Controls';
    } else if (filename.toLowerCase().includes('acoustic')) {
        subcategory = 'Acoustics';
    } else if (filename.toLowerCase().includes('servic')) {
        subcategory = 'Servicing';
        category = 'equipment-manuals';
    } else if (filename.toLowerCase().includes('beginner') || filename.toLowerCase().includes('tips')) {
        category = 'diy-guides';
    }

    return { title, category, subcategory, description };
}

async function processFiles() {
    if (!fs.existsSync(uploadsDir)) {
        console.log('`uploads` directory does not exist.');
        return;
    }

    if (!fs.existsSync(manualsDir)) {
        fs.mkdirSync(manualsDir, { recursive: true });
    }

    const files = fs.readdirSync(uploadsDir).filter(f => f !== '.gitkeep');

    if (files.length === 0) {
        console.log('No files found in the `uploads` directory.');
        return;
    }

    const manuals = JSON.parse(fs.readFileSync(manualsJsonPath, 'utf-8'));

    for (const file of files) {
        console.log(`--- Processing: ${file} ---`);
        const { title, category, subcategory, description } = generateMetadata(file);

        const sourcePath = path.join(uploadsDir, file);
        const destPath = path.join(manualsDir, file);

        fs.renameSync(sourcePath, destPath);

        const stats = fs.statSync(destPath);
        const fileType = path.extname(file).slice(1) === 'pdf' ? 'application/pdf' : 'application/epub+zip';

        const newManual = {
            id: (manuals.length + Date.now()).toString(), // More unique ID
            title,
            category,
            subcategory,
            description,
            fileName: file,
            fileSize: stats.size,
            fileType,
            url: `/manuals/${file}`,
            uploadDate: new Date().toISOString(),
            isPublic: true
        };

        manuals.unshift(newManual); // Add to the beginning of the list
        console.log(`Added '${title}' to the library.`);
    }

    fs.writeFileSync(manualsJsonPath, JSON.stringify(manuals, null, 2));
    console.log('\nSuccessfully updated the manuals library!');
}

processFiles().catch(console.error);
