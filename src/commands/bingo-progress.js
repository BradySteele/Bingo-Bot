const { PermissionFlagsBits } = require('discord.js');
const { loadConfig } = require('../utils/config');
const fs = require('fs');
const path = require('path');

function getCustomTileDescription(tile) {
    const customDescriptions = {
        'a2': 'Purifying Sigil pieces',
        'b3': 'Moons uniques',
        'a8': 'Full Oathplate',
        'b8': 'Full Justiciar',
        'd8': 'All DT2 uniques',
        'f8': 'Full Masori',
        'c5': 'All Odium shards',
        'd5': 'Full Sandwich Lady outfit',
        'e5': 'Any Royal outfit piece',
        'e3': 'Any skilling pet',
        'f5': 'Any demon mask',
        'b6': 'Any godsword ornament kit',
        'd6': 'Any Leviathan pet',
        'e4': 'Sunfire fanatic pieces',
        'f6': 'TOB ornament kits',
        'e8': 'Any gilded item'
    };
    
    if (customDescriptions[tile.coordinate]) {
        return customDescriptions[tile.coordinate];
    }
    
    if (tile.requirementType === 'single') {
        return tile.requiredItems[0];
    } else if (tile.requirementType === 'any') {
        return `Any: ${tile.requiredItems.slice(0, 2).join(', ')}${tile.requiredItems.length > 2 ? '...' : ''}`;
    } else if (tile.requirementType === 'multiple_same') {
        return `${tile.requiredCount}x ${tile.requiredItems[0]}`;
    } else if (tile.requirementType === 'all_different') {
        return `All: ${tile.requiredItems.join(', ')}`;
    } else if (tile.requirementType === 'total_any') {
        return `${tile.requiredCount} of: ${tile.requiredItems.join(', ')}`;
    } else {
        return tile.requiredItems.join(', ');
    }
}

module.exports = {
    name: 'bingo-progress',
    description: 'Show your team\'s bingo progress with completed and remaining items',
    async execute(message, args, client) {
        try {
            const config = loadConfig();
            const userId = message.author.id;
            
            if (!config) {
                return message.reply('❌ Configuration error: config data not found. Please contact an administrator.');
            }
            
            let userTeam = null;
            const teams = ['melon', 'weenor'];
            for (const team of teams) {
                if (config[team]) {
                    for (const [username, userData] of Object.entries(config[team])) {
                        if (userData.discordId === userId) {
                            userTeam = team;
                            break;
                        }
                    }
                    if (userTeam) break;
                }
            }
            
            if (!userTeam) {
                return message.reply('❌ You are not registered for the bingo competition. Please use the signup form first.');
            }
            
            const boardPath = path.join(__dirname, '..', '..', 'config', `bingo-board-${userTeam}.json`);
            if (!fs.existsSync(boardPath)) {
                return message.reply(`❌ Bingo board not found for team ${userTeam}.`);
            }
            
            const bingoBoard = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
            
            const completedItems = new Set();
            const itemCompletions = {};
            
            const tiles = Object.values(bingoBoard.tiles);
            const totalTiles = tiles.length;
            const completedTiles = tiles.filter(tile => tile.completed);
            const inProgressTiles = tiles.filter(tile => !tile.completed && tile.obtainedItems && tile.obtainedItems.length > 0);
            const remainingTiles = tiles.filter(tile => !tile.completed && (!tile.obtainedItems || tile.obtainedItems.length === 0));
            
            const completedCount = completedTiles.length;
            const totalPoints = bingoBoard.totalPoints || tiles.reduce((sum, tile) => sum + tile.points, 0);
            const earnedPoints = completedTiles.reduce((sum, tile) => sum + tile.points, 0);
            const progressPercentage = Math.round((completedCount / totalTiles) * 100);
            
            const progressBarLength = 20;
            const filledLength = Math.round((completedCount / totalTiles) * progressBarLength);
            const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
            
            const completed = [];
            const inProgress = [];
            const remaining = [];
            
            for (const tile of completedTiles) {
                const contributors = tile.obtainedItems.map(item => item.submitterRSN).filter((v, i, a) => a.indexOf(v) === i);
                const description = getCustomTileDescription(tile);
                completed.push(`✅ **${tile.coordinate.toUpperCase()}** (${tile.points}pts) - ${description} (${contributors.join(', ')})`);
            }
            
            for (const tile of inProgressTiles) {
                const contributors = tile.obtainedItems.map(item => item.submitterRSN).filter((v, i, a) => a.indexOf(v) === i);
                const progress = `${tile.obtainedItems.length}/${tile.requiredCount}`;
                const description = getCustomTileDescription(tile);
                inProgress.push(`🔄 **${tile.coordinate.toUpperCase()}** (${tile.points}pts) - ${description} (${progress}) - ${contributors.join(', ')}`);
            }
            
            for (const tile of remainingTiles) {
                const description = getCustomTileDescription(tile);
                remaining.push(`❌ **${tile.coordinate.toUpperCase()}** (${tile.points}pts) - ${description}`);
            }
            
            const teamColor = userTeam === 'melon' ? 0x90EE90 : 0xFFB6C1;
            const teamEmoji = userTeam === 'melon' ? '🍈' : '🌭';
            
            const embed = {
                color: teamColor,
                title: `${teamEmoji} Team ${userTeam.charAt(0).toUpperCase() + userTeam.slice(1)} Bingo Progress`,
                description: `**Progress: ${completedCount}/${totalTiles} tiles completed (${progressPercentage}%)**\n**Points: ${earnedPoints}/${totalPoints}**\n\`${progressBar}\``,
                fields: [],
                footer: {
                    text: 'Bingo Bot • Team Progress',
                    icon_url: message.guild.iconURL({ dynamic: true })
                },
                timestamp: new Date().toISOString()
            };
            
            if (completed.length > 0) {
                const completedText = completed.join('\n');
                if (completedText.length > 1024) {
                    const chunks = [];
                    let currentChunk = '';
                    for (const item of completed) {
                        if ((currentChunk + item + '\n').length > 1024) {
                            chunks.push(currentChunk);
                            currentChunk = item + '\n';
                        } else {
                            currentChunk += item + '\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);
                    
                    chunks.forEach((chunk, index) => {
                        embed.fields.push({
                            name: index === 0 ? '✅ Completed Tiles' : '✅ Completed Tiles (continued)',
                            value: chunk,
                            inline: false
                        });
                    });
                } else {
                    embed.fields.push({
                        name: '✅ Completed Tiles',
                        value: completedText,
                        inline: false
                    });
                }
            }
            
            if (inProgress.length > 0) {
                const inProgressText = inProgress.join('\n');
                if (inProgressText.length > 1024) {
                    const chunks = [];
                    let currentChunk = '';
                    for (const item of inProgress) {
                        if ((currentChunk + item + '\n').length > 1024) {
                            chunks.push(currentChunk);
                            currentChunk = item + '\n';
                        } else {
                            currentChunk += item + '\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);
                    
                    chunks.forEach((chunk, index) => {
                        embed.fields.push({
                            name: index === 0 ? '🔄 In Progress' : '🔄 In Progress (continued)',
                            value: chunk,
                            inline: false
                        });
                    });
                } else {
                    embed.fields.push({
                        name: '🔄 In Progress',
                        value: inProgressText,
                        inline: false
                    });
                }
            }
            
            if (remaining.length > 0) {
                const remainingToShow = remaining.slice(0, 10);
                const remainingText = remainingToShow.join('\n');
                const hiddenCount = remaining.length - remainingToShow.length;
                
                embed.fields.push({
                    name: `❌ Remaining Tiles${hiddenCount > 0 ? ` (showing 10/${remaining.length})` : ''}`,
                    value: remainingText,
                    inline: false
                });
            }
            
            if (completed.length === totalTiles) {
                embed.fields.push({
                    name: '🎉 All Tiles Complete!',
                    value: 'Congratulations! Your team has completed the entire bingo board!',
                    inline: false
                });
            }
            
            
            await message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in bingo-progress command:', error);
            await message.reply('❌ An error occurred while fetching your team\'s progress. Please try again later.');
        }
    },
};