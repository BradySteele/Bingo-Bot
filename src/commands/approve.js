const { PermissionFlagsBits } = require('discord.js');
const { addUserToTeam, removePendingUser, findPendingUser } = require('../utils/config');
module.exports = {
    name: 'approve',
    description: 'Approve a pending user and add them to a team',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        if (args.length < 1) {
            return message.reply('❌ Usage: `!approve <discord_username_or_id>`');
        }
        let targetUser;
        let discordId;
        const mention = message.mentions.users.first();
        if (mention) {
            targetUser = mention;
            discordId = mention.id;
        } else {
            const identifier = args[0];
            try {
                targetUser = await client.users.fetch(identifier);
                discordId = identifier;
            } catch {
                const guild = message.guild;
                const member = guild.members.cache.find(m => 
                    m.user.username === identifier || 
                    m.user.tag === identifier ||
                    m.displayName === identifier
                );
                if (member) {
                    targetUser = member.user;
                    discordId = member.id;
                } else {
                    return message.reply('❌ Could not find that user. Please use @mention, Discord ID, or exact username.');
                }
            }
        }
        const pendingUser = findPendingUser(discordId);
        if (!pendingUser) {
            return message.reply('❌ No pending signup found for that user.');
        }
        try {
            const normalizedTeam = pendingUser.team.toLowerCase().trim();
            addUserToTeam(pendingUser.username, normalizedTeam, discordId);
            removePendingUser(discordId);
            try {
                const { getFormResponses, markAsProcessed } = require('../utils/googleSheets');
                const allResponses = await getFormResponses();
                const responseIndex = allResponses.findIndex(response =>
                    response.username?.toLowerCase() === pendingUser.username.toLowerCase() &&
                    response.team?.toLowerCase() === pendingUser.team.toLowerCase()
                );
                if (responseIndex !== -1) {
                    await markAsProcessed(responseIndex);
                    console.log(`✅ Marked ${pendingUser.username} as processed in Google Sheets`);
                } else {
                    console.log(`⚠️ Could not find ${pendingUser.username} in Google Sheets to mark as processed`);
                }
            } catch (error) {
                console.error('Error marking user as processed in Google Sheets:', error);
            }
            const roleId = normalizedTeam === 'melon' ? process.env.MELON_ROLE_ID : process.env.WEENOR_ROLE_ID;
            const role = message.guild.roles.cache.get(roleId);
            if (role) {
                const member = message.guild.members.cache.get(discordId);
                if (member) {
                    if (!member.roles.cache.has(roleId)) {
                        try {
                            await member.roles.add(role);
                            console.log(`✅ Added ${normalizedTeam} role to ${targetUser.tag}`);
                        } catch (roleError) {
                            console.error(`❌ Failed to add role to ${targetUser.tag}:`, roleError.message);
                            return await message.reply(`❌ Failed to add role: ${roleError.message}\n\nCheck bot permissions and role hierarchy.`);
                        }
                    } else {
                        console.log(`⚠️ User ${targetUser.tag} already has ${normalizedTeam} role`);
                    }
                    if (member.displayName !== pendingUser.username) {
                        console.log(`⚠️ Warning: ${targetUser.tag} nickname "${member.displayName}" doesn't match RSN "${pendingUser.username}"`);
                    } else {
                        console.log(`✅ Nickname "${member.displayName}" matches RSN "${pendingUser.username}"`);
                    }
                    const channelIds = normalizedTeam === 'melon' ?
                        process.env.MELON_CHANNELS?.split(',') :
                        process.env.WEENOR_CHANNELS?.split(',');
                    if (channelIds) {
                        for (const channelId of channelIds) {
                            const channel = message.guild.channels.cache.get(channelId.trim());
                            if (channel) {
                                try {
                                    await channel.permissionOverwrites.create(member, {
                                        ViewChannel: true,
                                        SendMessages: true,
                                        ReadMessageHistory: true
                                    });
                                } catch (permError) {
                                    console.log(`⚠️ Could not set permissions for channel ${channel.name}:`, permError.message);
                                }
                            }
                        }
                    }
                } else {
                    return await message.reply(`❌ User not found in server. Make sure they've joined the Discord server.`);
                }
            } else {
                return await message.reply(`❌ Could not find ${normalizedTeam} role. Check your role IDs in .env file.`);
            }
            const embed = {
                color: normalizedTeam === 'melon' ? 0x90EE90 : 0xFFB6C1, 
                title: '✅ User Approved!',
                description: `${pendingUser.username} has been approved and added to team ${normalizedTeam.charAt(0).toUpperCase() + normalizedTeam.slice(1)}.`,
                fields: [
                    { name: 'RSN', value: pendingUser.username, inline: true },
                    { name: 'Team', value: normalizedTeam.charAt(0).toUpperCase() + normalizedTeam.slice(1), inline: true },
                    { name: 'Discord User', value: targetUser.tag, inline: true }
                ],
                timestamp: new Date().toISOString()
            };
            await message.reply({ embeds: [embed] });
            const member = message.guild.members.cache.get(discordId);
            if (member) {
                const threadName = `${targetUser.username}-verification`; 
                console.log(`🔍 Looking for verification thread to clean up: "${threadName}"`);
                const rsnVerificationChannel = message.guild.channels.cache.find(channel =>
                    channel.type === 0 && channel.name === 'rsn-verification'
                );
                let verificationThread = null;
                if (rsnVerificationChannel) {
                    await rsnVerificationChannel.threads.fetchActive();
                    await rsnVerificationChannel.threads.fetchArchived();
                    verificationThread = rsnVerificationChannel.threads.cache.find(thread =>
                        thread.name === threadName
                    );
                    console.log(`🔍 Found verification thread: ${verificationThread ? 'yes' : 'no'}`);
                    console.log(`🔍 Available threads:`, rsnVerificationChannel.threads.cache.map(t => t.name).join(', ') || 'none');
                }
                try {
                    const approvalDM = `🎉 **Verification Complete!**
Your signup has been approved!
✅ **Team:** ${normalizedTeam.charAt(0).toUpperCase() + normalizedTeam.slice(1)}
🏷️ **RSN:** ${pendingUser.username}
🔑 **Access:** You now have access to your team channels!
Welcome to team ${normalizedTeam.charAt(0).toUpperCase() + normalizedTeam.slice(1)}! 🎊`;
                    await member.send(approvalDM);
                    console.log(`📨 Sent final approval DM to ${targetUser.tag}`);
                } catch (error) {
                    console.error('❌ Could not send approval DM:', error.message);
                }
                if (verificationThread) {
                    try {
                        console.log(`🧹 Starting thread cleanup for ${targetUser.tag} in thread: ${verificationThread.name}`);
                        const closingEmbed = {
                            color: normalizedTeam === 'melon' ? 0x90EE90 : 0xFFB6C1,
                            title: '✅ Verification Complete!',
                            description: 'Your verification has been approved! This thread will be closed shortly.',
                            fields: [
                                { name: '📨 Check your DMs', value: 'A confirmation message has been sent to your DMs', inline: false }
                            ],
                            footer: {
                                text: 'Bingo Bot • Thread closing in 10 seconds'
                            },
                            timestamp: new Date().toISOString()
                        };
                        await verificationThread.send({
                            content: `${member}`,
                            embeds: [closingEmbed]
                        });
                        console.log(`⏰ Setting 10-second timer to archive thread: ${verificationThread.name}`);
                        const threadToClose = verificationThread;
                        const userTag = targetUser.tag;
                        setTimeout(async () => {
                            try {
                                console.log(`🗂️ Attempting to archive thread: ${threadToClose.name} for ${userTag}`);
                                if (!threadToClose.archived) {
                                    await threadToClose.setArchived(true);
                                    console.log(`✅ Successfully archived verification thread for ${userTag}`);
                                } else {
                                    console.log(`ℹ️ Thread ${threadToClose.name} was already archived`);
                                }
                            } catch (archiveError) {
                                console.error(`❌ Failed to archive thread ${threadToClose.name}:`, archiveError.message);
                                try {
                                    await threadToClose.setLocked(true);
                                    console.log(`🔒 Locked thread ${threadToClose.name} as fallback for ${userTag}`);
                                } catch (lockError) {
                                    console.error(`❌ Failed to lock thread as fallback:`, lockError.message);
                                }
                            }
                        }, 10000); 
                        console.log(`✅ Sent closing message to verification thread for ${targetUser.tag}`);
                    } catch (error) {
                        console.error('❌ Could not send closing message to thread:', error.message);
                        try {
                            console.log(`🗂️ Attempting thread closure despite message error for ${targetUser.tag}`);
                            setTimeout(async () => {
                                try {
                                    await verificationThread.setArchived(true);
                                    console.log(`✅ Archived thread despite message error for ${targetUser.tag}`);
                                } catch (archiveError) {
                                    console.error(`❌ Final thread archive attempt failed:`, archiveError.message);
                                }
                            }, 5000); 
                        } catch (fallbackError) {
                            console.error(`❌ Fallback thread closure failed:`, fallbackError.message);
                        }
                    }
                } else {
                    console.log(`⚠️ No verification thread found to clean up for ${targetUser.tag}`);
                }
            }
        } catch (error) {
            console.error('Error approving user:', error);
            await message.reply('❌ An error occurred while approving the user.');
        }
    }
};