const fs = require('fs');
const path = require('path');
const MELON_BOARD_PATH = path.join(__dirname, '../../config/bingo-board-melon.json');
const WEENOR_BOARD_PATH = path.join(__dirname, '../../config/bingo-board-weenor.json');
function loadBingoBoard(team) {
    const boardPath = team === 'melon' ? MELON_BOARD_PATH : WEENOR_BOARD_PATH;
    if (!fs.existsSync(boardPath)) {
        throw new Error(`Bingo board not found for team ${team}`);
    }
    return JSON.parse(fs.readFileSync(boardPath, 'utf8'));
}
function saveBingoBoard(team, board) {
    const boardPath = team === 'melon' ? MELON_BOARD_PATH : WEENOR_BOARD_PATH;
    fs.writeFileSync(boardPath, JSON.stringify(board, null, 2));
}
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) {
        return Math.max(s2.length / s1.length, s1.length / s2.length) * 0.95;
    }
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const [shorter, longer] = words1.length <= words2.length ? [words1, words2] : [words2, words1];
    let matchedWords = 0;
    for (const word of shorter) {
        if (word.length >= 3) { 
            const found = longer.some(longerWord =>
                longerWord.includes(word) || word.includes(longerWord) ||
                levenshteinDistance(word, longerWord) <= 1
            );
            if (found) matchedWords++;
        }
    }
    if (shorter.length > 0 && matchedWords >= Math.max(1, Math.floor(shorter.length * 0.7))) {
        const wordSimilarity = matchedWords / shorter.length;
        return Math.min(0.95, wordSimilarity * 0.9);
    }
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    const distance = levenshteinDistance(s1, s2);
    return (maxLen - distance) / maxLen;
}
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, 
                    matrix[i][j - 1] + 1,     
                    matrix[i - 1][j] + 1      
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}
function findTileForItem(team, itemName) {
    const board = loadBingoBoard(team);
    const normalizedItem = itemName.toLowerCase().trim();
    let bestMatch = null;
    let bestSimilarity = 0;
    const similarMatches = [];
    for (const [coordinate, tile] of Object.entries(board.tiles)) {
        for (const requiredItem of tile.requiredItems) {
            const similarity = calculateSimilarity(normalizedItem, requiredItem);
            if (similarity === 1) {
                return {
                    coordinate,
                    tile,
                    exactItemName: requiredItem,
                    similarity: 1,
                    matchType: 'exact'
                };
            }
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = {
                    coordinate,
                    tile,
                    exactItemName: requiredItem,
                    similarity,
                    matchType: similarity >= 0.9 ? 'high' : similarity >= 0.7 ? 'good' : 'weak'
                };
            }
            if (similarity >= 0.7 && similarity < 1) {
                similarMatches.push({
                    coordinate,
                    tile,
                    exactItemName: requiredItem,
                    similarity,
                    matchType: similarity >= 0.9 ? 'high' : 'good'
                });
            }
        }
    }
    if (bestMatch && bestSimilarity >= 0.7) {
        if (bestSimilarity < 0.9) {
            bestMatch.similarMatches = similarMatches
                .filter(match => match.exactItemName !== bestMatch.exactItemName)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 3);
        }
        return bestMatch;
    }
    return null;
}
function canSubmitItem(tile, exactItemName, submittedBy) {
    if (tile.completed) {
        return { valid: false, reason: 'Tile already completed' };
    }
    const existingSubmission = tile.submissions.find(sub =>
        sub.submittedBy === submittedBy &&
        sub.itemName.toLowerCase().trim() === exactItemName.toLowerCase().trim()
    );
    if (existingSubmission) {
        return { valid: false, reason: 'Your team has already submitted this item for this tile' };
    }
    return { valid: true, exactItemName };
}
function addSubmission(team, coordinate, itemName, submittedBy, submitterRSN, attachmentUrl, submissionId, originalInput = null, similarity = 1) {
    const board = loadBingoBoard(team);
    const tile = board.tiles[coordinate];
    if (!tile) {
        throw new Error(`Tile ${coordinate} not found`);
    }
    const submission = {
        id: submissionId,
        itemName,
        originalInput: originalInput || itemName, 
        similarity: similarity,
        submittedBy,
        submitterRSN,
        attachmentUrl,
        timestamp: new Date().toISOString(),
        approved: false
    };
    tile.submissions.push(submission);
    saveBingoBoard(team, board);
    return submission;
}
function approveSubmission(team, coordinate, submissionId) {
    const board = loadBingoBoard(team);
    const tile = board.tiles[coordinate];
    if (!tile) {
        throw new Error(`Tile ${coordinate} not found`);
    }
    const submission = tile.submissions.find(sub => sub.id === submissionId);
    if (!submission) {
        throw new Error(`Submission ${submissionId} not found`);
    }
    if (submission.approved) {
        throw new Error('Submission already approved');
    }
    submission.approved = true;
    const itemExists = tile.obtainedItems.some(item => 
        item.itemName.toLowerCase().trim() === submission.itemName.toLowerCase().trim()
    );
    if (!itemExists) {
        tile.obtainedItems.push({
            itemName: submission.itemName,
            submittedBy: submission.submittedBy,
            submitterRSN: submission.submitterRSN,
            timestamp: submission.timestamp
        });
    }
    const progress = calculateTileProgress(tile);
    const wasCompleted = tile.completed;
    if (progress.completed && !wasCompleted) {
        tile.completed = true;
        board.totalPoints += tile.points;
    }
    saveBingoBoard(team, board);
    return {
        submission,
        progress,
        tileCompleted: progress.completed && !wasCompleted,
        newTotalPoints: board.totalPoints
    };
}
function calculateTileProgress(tile) {
    const obtainedCount = tile.obtainedItems.length;
    const requiredCount = tile.requiredCount;
    let completed = false;
    let description = '';
    switch (tile.requirementType) {
        case 'single':
            completed = obtainedCount >= 1;
            description = `${obtainedCount}/1`;
            break;
        case 'multiple_same':
            completed = obtainedCount >= requiredCount;
            description = `${obtainedCount}/${requiredCount}`;
            break;
        case 'different':
        case 'all_different':
            const uniqueItems = new Set(tile.obtainedItems.map(item => item.itemName.toLowerCase()));
            completed = uniqueItems.size >= requiredCount;
            description = `${uniqueItems.size}/${requiredCount}`;
            break;
        case 'any':
            completed = obtainedCount >= 1;
            description = `${obtainedCount}/1`;
            break;
        case 'total_any':
            completed = obtainedCount >= requiredCount;
            description = `${obtainedCount}/${requiredCount}`;
            break;
        default:
            completed = obtainedCount >= requiredCount;
            description = `${obtainedCount}/${requiredCount}`;
    }
    return {
        completed,
        current: obtainedCount,
        required: requiredCount,
        description,
        obtainedItems: tile.obtainedItems
    };
}
function getPendingSubmissions() {
    const pendingSubmissions = [];
    ['melon', 'weenor'].forEach(team => {
        try {
            const board = loadBingoBoard(team);
            Object.entries(board.tiles).forEach(([coordinate, tile]) => {
                tile.submissions.forEach(submission => {
                    if (!submission.approved) {
                        pendingSubmissions.push({
                            team,
                            coordinate,
                            submission,
                            tile
                        });
                    }
                });
            });
        } catch (error) {
            console.error(`Error loading ${team} board:`, error);
        }
    });
    return pendingSubmissions;
}
function generateSubmissionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
module.exports = {
    loadBingoBoard,
    saveBingoBoard,
    findTileForItem,
    canSubmitItem,
    addSubmission,
    approveSubmission,
    calculateTileProgress,
    getPendingSubmissions,
    generateSubmissionId
};