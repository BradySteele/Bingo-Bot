const { PermissionFlagsBits } = require('discord.js');
const { loadConfig } = require('../utils/config');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'bingo-progress',
    description: 'Show your team\'s bingo progress with completed and remaining items',
    async execute(message, args, client) {
        try {
            const config = loadConfig();
            const userId = message.author.id;
            
            let userTeam = null;
            for (const [team, users] of Object.entries(config.teams)) {
                if (users.some(user => user.discordId === userId)) {
                    userTeam = team;
                    break;
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
            
            for (const user of config.teams[userTeam]) {
                if (user.completedItems) {
                    for (const item of user.completedItems) {
                        completedItems.add(item.toLowerCase());
                        if (!itemCompletions[item.toLowerCase()]) {
                            itemCompletions[item.toLowerCase()] = [];
                        }
                        itemCompletions[item.toLowerCase()].push(user.username);
                    }
                }
            }
            
            const totalItems = bingoBoard.items.length;
            const completedCount = completedItems.size;
            const progressPercentage = Math.round((completedCount / totalItems) * 100);
            
            const progressBarLength = 20;
            const filledLength = Math.round((completedCount / totalItems) * progressBarLength);
            const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
            
            const completed = [];
            const remaining = [];
            
            for (const item of bingoBoard.items) {
                const itemLower = item.toLowerCase();
                if (completedItems.has(itemLower)) {
                    const completedBy = itemCompletions[itemLower];
                    const uniqueCompletedBy = [...new Set(completedBy)];
                    completed.push(`✅ ${item} (${uniqueCompletedBy.join(', ')})`);
                } else {
                    remaining.push(`❌ ${item}`);
                }
            }
            
            const teamColor = userTeam === 'melon' ? 0x90EE90 : 0xFFB6C1;
            const teamEmoji = userTeam === 'melon' ? '🍈' : '🌭';
            
            const embed = {
                color: teamColor,
                title: `${teamEmoji} Team ${userTeam.charAt(0).toUpperCase() + userTeam.slice(1)} Bingo Progress`,
                description: `**Progress: ${completedCount}/${totalItems} items completed (${progressPercentage}%)**\n\`${progressBar}\``,
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
                            name: index === 0 ? '✅ Completed Items' : '✅ Completed Items (continued)',
                            value: chunk,
                            inline: false
                        });
                    });
                } else {
                    embed.fields.push({
                        name: '✅ Completed Items',
                        value: completedText,
                        inline: false
                    });
                }
            } else {
                embed.fields.push({
                    name: '✅ Completed Items',
                    value: 'None yet - get started!',
                    inline: false
                });
            }
            
            if (remaining.length > 0) {
                const remainingText = remaining.join('\n');
                if (remainingText.length > 1024) {
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
                        embed.fields.push({
                            name: index === 0 ? '❌ Remaining Items' : '❌ Remaining Items (continued)',
                            value: chunk,
                            inline: false
                        });
                    });
                } else {
                    embed.fields.push({
                        name: '❌ Remaining Items',
                        value: remainingText,
                        inline: false
                    });
                }
            } else {
                embed.fields.push({
                    name: '🎉 All Items Complete!',
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