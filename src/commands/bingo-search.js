const { EmbedBuilder } = require('discord.js');
const { findUserByDiscordId } = require('../utils/config');
const { loadBingoBoard } = require('../utils/bingo');
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) {
        return Math.max(s2.length / s1.length, s1.length / s2.length) * 0.95;
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
module.exports = {
    name: 'bingo-search',
    description: 'Search for items on your team\'s bingo board',
    async execute(message, args) {
        try {
            const user = findUserByDiscordId(message.author.id);
            if (!user || !user.approved) {
                return message.reply('❌ You must be an approved team member to search the bingo board.');
            }
            const team = user.team;
            if (!args || args.length === 0) {
                return message.reply('❌ Please provide a search term. Usage: `!bingo-search <item name>`\nExample: `!bingo-search elder` or `!bingo-search mask`');
            }
            const searchTerm = args.join(' ').toLowerCase().trim();
            const board = loadBingoBoard(team);
            const matches = [];
            Object.entries(board.tiles).forEach(([coordinate, tile]) => {
                tile.requiredItems.forEach(item => {
                    const similarity = calculateSimilarity(searchTerm, item);
                    if (similarity >= 0.5 || item.toLowerCase().includes(searchTerm) || searchTerm.includes(item.toLowerCase())) {
                        matches.push({
                            coordinate: coordinate.toUpperCase(),
                            item,
                            similarity,
                            points: tile.points,
                            completed: tile.completed,
                            requirementType: tile.requirementType,
                            requiredCount: tile.requiredCount,
                            totalRequired: tile.requiredItems.length
                        });
                    }
                });
            });
            if (matches.length === 0) {
                return message.reply(`❌ No items found matching "${searchTerm}" for team ${team.charAt(0).toUpperCase() + team.slice(1)}.\n\nTry using part of the item name or check the spelling.`);
            }
            matches.sort((a, b) => {
                if (Math.abs(a.similarity - b.similarity) < 0.1) {
                    return b.points - a.points; 
                }
                return b.similarity - a.similarity; 
            });
            const topMatches = matches.slice(0, 15);
            const embed = new EmbedBuilder()
                .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                .setTitle(`🔍 Search Results for "${searchTerm}"`)
                .setDescription(`Found ${matches.length} matching item${matches.length !== 1 ? 's' : ''} for team ${team.charAt(0).toUpperCase() + team.slice(1)}`)
                .setFooter({
                    text: `Showing top ${Math.min(15, matches.length)} results • Use exact item names when submitting`
                });
            const resultText = topMatches.map(match => {
                const status = match.completed ? '✅' : '❌';
                const confidence = match.similarity >= 0.9 ? '' : ` (${Math.round(match.similarity * 100)}% match)`;
                let requirement = '';
                if (match.totalRequired > 1) {
                    if (match.requirementType === 'single') {
                        requirement = '';
                    } else if (match.requirementType === 'any') {
                        requirement = ` - need any 1`;
                    } else if (match.requirementType === 'all_different') {
                        requirement = ` - need all ${match.requiredCount}`;
                    } else if (match.requirementType === 'different') {
                        requirement = ` - need ${match.requiredCount} different`;
                    } else if (match.requirementType === 'multiple_same') {
                        requirement = ` - need ${match.requiredCount}x`;
                    } else if (match.requirementType === 'total_any') {
                        requirement = ` - need ${match.requiredCount} total`;
                    }
                }
                return `${status} **${match.coordinate}** (${match.points}pts): ${match.item}${confidence}${requirement}`;
            }).join('\n');
            embed.addFields({
                name: 'Matches',
                value: resultText,
                inline: false
            });
            if (topMatches.some(match => match.similarity < 1)) {
                embed.addFields({
                    name: '💡 Tip',
                    value: 'When submitting, use the exact item name shown above for best results.',
                    inline: false
                });
            }
            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in bingo-search command:', error);
            await message.reply('❌ An error occurred while searching the bingo board. Please try again.');
        }
    },
};