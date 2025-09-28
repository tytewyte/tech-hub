const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const EPub = require('epub').Epub;
const Manual = require('../models/Manual');

const manualsDir = path.join(__dirname, '..', 'public', 'manuals');

async function parseEpub(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const epub = new EPub(filePath);
            let textContent = '';

            epub.on('end', () => {
                epub.flow.forEach(chapter => {
                    epub.getChapter(chapter.id, (err, text) => {
                        if (text) {
                            textContent += text.replace(/<[^>]+>/g, ' ') + '\n\n'; // Strip HTML tags
                        }
                    });
                });
                resolve(textContent);
            });

            epub.on('error', reject);

            epub.parse();
        } catch (error) {
            reject(error);
        }
    });
}

async function getManualContent(manual) {
    const filePath = path.join(manualsDir, manual.fileName);
    try {
        await fs.access(filePath);
    } catch (error) {
        console.error(`File not found: ${filePath}`);
        return ''; // File does not exist
    }

    const fileExtension = path.extname(manual.fileName).toLowerCase();

    try {
        if (fileExtension === '.pdf') {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } else if (fileExtension === '.epub') {
            return await parseEpub(filePath);
        } else {
            // For .txt or .md files
            return await fs.readFile(filePath, 'utf-8');
        }
    } catch (error) {
        console.error(`Error parsing ${manual.fileName}:`, error);
        return ''; // Return empty string if parsing fails
    }
}

async function searchManuals(query) {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    if (searchTerms.length === 0) return [];

    const allManuals = await Manual.find({ isPublic: true });
    const searchResults = [];

    for (const manual of allManuals) {
        const content = await getManualContent(manual);
        if (!content) continue;

        const contentLower = content.toLowerCase();
        let relevanceScore = 0;
        const snippets = [];

        for (const term of searchTerms) {
            const termOccurrences = (contentLower.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
            if (termOccurrences > 0) {
                relevanceScore += termOccurrences;

                // Add a snippet for the first occurrence of the term
                const firstIndex = contentLower.indexOf(term);
                if (firstIndex !== -1) {
                    const start = Math.max(0, firstIndex - 50);
                    const end = Math.min(content.length, firstIndex + 50);
                    snippets.push(`...${content.substring(start, end)}...`);
                }
            }
        }

        if (relevanceScore > 0) {
            searchResults.push({
                title: manual.title,
                fileName: manual.fileName,
                score: relevanceScore,
                snippet: snippets[0] || '' // Take the first snippet as a preview
            });
        }
    }

    // Sort results by relevance score in descending order
    searchResults.sort((a, b) => b.score - a.score);

    return searchResults.slice(0, 3); // Return top 3 results
}

module.exports = { searchManuals };
