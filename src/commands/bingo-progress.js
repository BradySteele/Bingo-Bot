const { PermissionFlagsBits } = require('discord.js');
const { loadConfig } = require('../utils/config');
const fs = require('fs');
const path = require('path');

function getCustomTileDescription(tile) {
    const customDescriptions = {
        'a2': 'Purifying Sigil pieces',
        'a8': 'Full Oathplate',
        'b3': 'Moons uniques',
        'b6': 'Godsword Ornament Kit',
        'b8': 'Full Justiciar',
        'c5': 'All 3 Odium Shards',
        'c7': 'Any Mutagen',
        'd5': 'Full Sandwich Lady',
        'd6': 'Baron or Lil\'viathan',
        'd8': 'Completed Soulreaper Axe',
        'e3': 'Any skilling pet',
        'e4': 'Sunfire Fanatic Pieces',
        'e5': 'Any Royal piece',
        'e8': 'Any Gilded piece',
        'f5': 'Any demon mask',
        'f6': 'Holy or Sanguine kits',
        'f8': 'Full Masori'
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
            
            const tiles = Object.values(bingoBoard.tiles);
            const totalTiles = tiles.length;
            const completedTiles = tiles.filter(tile => tile.completed);
            const inProgressTiles = tiles.filter(tile => !tile.completed && tile.obtainedItems && tile.obtainedItems.length > 0);
            const remainingTiles = tiles.filter(tile => !tile.completed && (!tile.obtainedItems || tile.obtainedItems.length === 0));
            
            const completedCount = completedTiles.length;
            const totalPoints = tiles.reduce((sum, tile) => sum + tile.points, 0);
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
            
            const messages = [];
            
            const firstEmbed = {
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
            
            if (completed.length === totalTiles) {
                firstEmbed.fields.push({
                    name: '🎉 All Tiles Complete!',
                    value: 'Congratulations! Your team has completed the entire bingo board!',
                    inline: false
                });
            }
            
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
                        firstEmbed.fields.push({
                            name: index === 0 ? '✅ Completed Tiles' : '✅ Completed Tiles (continued)',
                            value: chunk,
                            inline: false
                        });
                    });
                } else {
                    firstEmbed.fields.push({
                        name: '✅ Completed Tiles',
                        value: completedText,
                        inline: false
                    });
                }
            }
            
            messages.push({ embeds: [firstEmbed] });
            
            if (inProgress.length > 0) {
                const inProgressEmbed = {
                    color: teamColor,
                    title: '🔄 In Progress Tiles',
                    fields: [],
                    footer: {
                        text: 'Bingo Bot • Team Progress',
                        icon_url: message.guild.iconURL({ dynamic: true })
                    },
                    timestamp: new Date().toISOString()
                };
                
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
                        inProgressEmbed.fields.push({
                            name: index === 0 ? '🔄 In Progress' : '🔄 In Progress (continued)',
                            value: chunk,
                            inline: false
                        });
                    });
                } else {
                    inProgressEmbed.fields.push({
                        name: '🔄 In Progress',
                        value: inProgressText,
                        inline: false
                    });
                }
                
                messages.push({ embeds: [inProgressEmbed] });
            }
            
            if (remaining.length > 0) {
                const remainingText = remaining.join('\n');
                
                if (remainingText.length <= 1024) {
                    const remainingEmbed = {
                        color: teamColor,
                        title: '❌ Remaining Tiles',
                        fields: [{
                            name: '❌ Remaining Tiles',
                            value: remainingText,
                            inline: false
                        }],
                        footer: {
                            text: 'Bingo Bot • Team Progress',
                            icon_url: message.guild.iconURL({ dynamic: true })
                        },
                        timestamp: new Date().toISOString()
                    };
                    messages.push({ embeds: [remainingEmbed] });
                } else {
                    const chunks = [];
                    let currentChunk = '';
                    for (const item of remaining) {
                        if ((currentChunk + item + '\n').length > 1024) {
                            chunks.push(currentChunk);
                            currentChunk = item + '\n';
                        } else {
                            currentChunk += item + '\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);
                    
                    chunks.forEach((chunk, index) => {
                        const remainingEmbed = {
                            color: teamColor,
                            title: index === 0 ? '❌ Remaining Tiles' : `❌ Remaining Tiles (${index + 1}/${chunks.length})`,
                            fields: [{
                                name: index === 0 ? '❌ Remaining Tiles' : '❌ Remaining Tiles (continued)',
                                value: chunk,
                                inline: false
                            }],
                            footer: {
                                text: 'Bingo Bot • Team Progress',
                                icon_url: message.guild.iconURL({ dynamic: true })
                            },
                            timestamp: new Date().toISOString()
                        };
                        messages.push({ embeds: [remainingEmbed] });
                    });
                }
            }
            
            for (let i = 0; i < messages.length; i++) {
                if (i === 0) {
                    await message.reply(messages[i]);
                } else {
                    await message.channel.send(messages[i]);
                }
                if (i < messages.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
        } catch (error) {
            console.error('Error in bingo-progress command:', error);
            await message.reply('❌ An error occurred while fetching your team\'s progress. Please try again later.');
        }
    },
};