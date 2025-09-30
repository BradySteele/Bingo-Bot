const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { findUserByUsername, addPendingUser } = require('../utils/config');
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isButton()) {
            if (interaction.customId === 'verify_rsn') {
                await handleVerifyRSNButton(interaction);
            } else if (interaction.customId.startsWith('approve_')) {
                await handleApproveButton(interaction);
            } else if (interaction.customId.startsWith('bingo_approve_')) {
                await handleBingoApproveButton(interaction);
            }
        }
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'rsn_verification_modal') {
                await handleRSNSubmission(interaction);
            }
        }
    },
};
async function handleVerifyRSNButton(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('rsn_verification_modal')
        .setTitle('RSN Verification');
    const rsnInput = new TextInputBuilder()
        .setCustomId('rsn_input')
        .setLabel('Your RuneScape Username (RSN)')
        .setPlaceholder('Enter your RSN')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(12); 
    const actionRow = new ActionRowBuilder().addComponents(rsnInput);
    modal.addComponents(actionRow);
    await interaction.showModal(modal);
}
async function handleRSNSubmission(interaction) {
    await interaction.deferReply({ flags: 64 }); 
    const rsn = interaction.fields.getTextInputValue('rsn_input');
    const user = interaction.user;
    const member = interaction.member;
    console.log(`🔍 RSN verification attempt: "${rsn}" by ${user.tag}`);
    try {
        const { findUserInUnprocessed, moveUnprocessedToPending } = require('../utils/config');
        const unprocessedEntry = findUserInUnprocessed(rsn);
        if (!unprocessedEntry) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ RSN Not Found')
                .setDescription(`The RSN "${rsn}" was not found in our signup list.`)
                .addFields(
                    {
                        name: '🤔 What to check:',
                        value: '• Make sure the RSN matches exactly (case-sensitive)\n• Ensure you signed up using the Google Form\n• Make sure your bingo buy-in has been paid\n• Check that an admin has imported your signup with !sync\n• Contact an admin if you believe this is an error',
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Bingo Bot • Try again with the exact RSN'
                });
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        const approvedUser = findUserByUsername(rsn);
        if (approvedUser && approvedUser.approved) {
            const teamRoleId = approvedUser.team === 'melon' ? process.env.MELON_ROLE_ID : process.env.WEENOR_ROLE_ID;
            const hasRole = member && member.roles.cache.has(teamRoleId);
            if (hasRole) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('✅ Already Approved')
                    .setDescription(`The RSN "${rsn}" has already been approved and assigned to team ${approvedUser.team.charAt(0).toUpperCase() + approvedUser.team.slice(1)}.`)
                    .setFooter({
                        text: 'Bingo Bot • You should already have your team role'
                    });
                return await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                console.log(`⚠️ Data inconsistency: ${user.tag} marked approved but missing role. Allowing re-verification.`);
                const warningEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('🔧 Fixing Account Issue')
                    .setDescription(`Your account shows as approved but you're missing your team role. Let me fix this for you...`)
                    .setFooter({
                        text: 'Bingo Bot • Fixing data inconsistency'
                    });
                await interaction.editReply({ embeds: [warningEmbed] });
                const { removeUser } = require('../utils/config');
                removeUser(rsn);
                addPendingUser(rsn, unprocessedEntry.team.toLowerCase().trim(), user.id);
                const adminChannelId = process.env.ADMIN_CHANNEL_ID;
                let adminChannel = null;
                if (interaction.guild) {
                    adminChannel = interaction.guild.channels.cache.get(adminChannelId);
                } else {
                    const guild = interaction.client.guilds.cache.first();
                    if (guild) {
                        adminChannel = guild.channels.cache.get(adminChannelId);
                    }
                }
                if (adminChannel) {
                    try {
                        const notificationEmbed = new EmbedBuilder()
                            .setColor(unprocessedEntry.team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                            .setTitle('🔧 Data Fix - Re-approval Needed')
                            .addFields(
                                { name: 'RSN', value: rsn, inline: true },
                                { name: 'Team', value: unprocessedEntry.team.charAt(0).toUpperCase() + unprocessedEntry.team.slice(1), inline: true },
                                { name: 'Discord User', value: `${user.tag}\n<@${user.id}>`, inline: true },
                                { name: 'Issue', value: 'User was marked approved but missing role', inline: false },
                                { name: 'Action Required', value: `\`!approve ${user.id}\``, inline: true }
                            )
                            .setThumbnail(user.displayAvatarURL())
                            .setFooter({
                                text: 'Bingo Bot • Data inconsistency fixed, re-approval needed'
                            })
                            .setTimestamp();
                        await adminChannel.send({ embeds: [notificationEmbed] });
                        console.log(`✅ Sent admin re-approval notification for ${user.tag}`);
                    } catch (error) {
                        console.error(`❌ Failed to send admin notification:`, error);
                    }
                }
                const guild = interaction.guild || interaction.client.guilds.cache.find(g => g.members.cache.has(user.id));
                if (guild) {
                    const rsnVerificationChannel = guild.channels.cache.find(channel =>
                        channel.type === 0 && channel.name === 'rsn-verification'
                    );
                    if (rsnVerificationChannel) {
                        console.log(`🔍 Looking for existing verification thread for re-approval message...`);
                        try {
                            await rsnVerificationChannel.threads.fetchActive();
                            await rsnVerificationChannel.threads.fetchArchived();
                            const threadName = `${user.username}-verification`;
                            const existingThread = rsnVerificationChannel.threads.cache.find(thread =>
                                thread.name === threadName
                            );
                            console.log(`🔍 Found existing thread "${threadName}": ${existingThread ? 'yes' : 'no'}`);
                            if (existingThread) {
                                const threadEmbed = new EmbedBuilder()
                                    .setColor(0xFFA500)
                                    .setTitle('🔧 Account Fixed - Re-approval in Progress')
                                    .setDescription(`Your account issue has been resolved and you're now in the re-approval queue.`)
                                    .addFields(
                                        {
                                            name: '✅ What was fixed:',
                                            value: 'Your account was marked approved but missing team role',
                                            inline: false
                                        },
                                        {
                                            name: '⏳ Next steps:',
                                            value: 'An admin will re-approve your account and assign your team role',
                                            inline: false
                                        }
                                    )
                                    .setFooter({ text: 'Bingo Bot • Re-approval Required' })
                                    .setTimestamp();
                                await existingThread.send({
                                    content: `${user}`,
                                    embeds: [threadEmbed]
                                });
                                console.log(`✅ Sent re-approval message to existing verification thread`);
                            } else {
                                console.log(`⚠️ No existing verification thread found for ${user.username} - this shouldn't happen`);
                            }
                        } catch (error) {
                            console.error(`❌ Failed to send re-approval message to existing thread:`, error);
                        }
                    }
                }
                return; 
            }
        }
        const team = unprocessedEntry.team.toLowerCase().trim();
        if (team !== 'melon' && team !== 'weenor') {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Invalid Team')
                .setDescription(`Invalid team "${unprocessedEntry.team}" in your signup. Contact an admin.`)
                .setFooter({
                    text: 'Bingo Bot • Contact an admin'
                });
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        if (approvedUser && approvedUser.discordId && approvedUser.discordId !== user.id) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ RSN Already Assigned')
                .setDescription(`The RSN "${rsn}" is already assigned to another Discord account.`)
                .addFields(
                    {
                        name: '📞 Contact Support',
                        value: 'Please contact an admin to resolve this issue.',
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Bingo Bot • Contact an admin'
                });
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        const { loadConfig } = require('../utils/config');
        const config = loadConfig();
        const existingPending = config.pending.find(p => p.discordId === user.id);
        if (existingPending) {
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Verification Already Pending')
                .setDescription(`You already have a pending verification for RSN "${existingPending.username}".`)
                .addFields(
                    {
                        name: '⏳ Please Wait',
                        value: 'An admin will review your verification request soon.',
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Bingo Bot • Please be patient'
                });
            return await interaction.editReply({ embeds: [warningEmbed] });
        }
        if (member) {
            try {
                await member.setNickname(rsn);
                console.log(`✅ Set ${user.tag} nickname to "${rsn}" for verification`);
            } catch (error) {
                console.log(`⚠️ Could not set nickname for ${user.tag}:`, error.message);
            }
        } else {
            console.log(`⚠️ Cannot set nickname - user ${user.tag} not in guild context`);
        }
        let verificationThread;
        try {
            let guild = interaction.guild;
            console.log(`🔍 Finding existing verification thread for ${user.tag}`);
            if (!guild) {
                guild = interaction.client.guilds.cache.find(g => g.members.cache.has(user.id));
                console.log(`🔍 Found guild via user lookup: ${guild ? guild.name : 'null'}`);
            }
            if (guild) {
                const rsnVerificationChannel = guild.channels.cache.find(channel =>
                    channel.type === 0 && channel.name === 'rsn-verification'
                );
                if (rsnVerificationChannel) {
                    await rsnVerificationChannel.threads.fetchActive();
                    await rsnVerificationChannel.threads.fetchArchived();
                    const threadName = `${user.username}-verification`;
                    verificationThread = rsnVerificationChannel.threads.cache.find(thread =>
                        thread.name === threadName
                    );
                    console.log(`🔍 Looking for thread: "${threadName}"`);
                    console.log(`🔍 Found existing verification thread: ${verificationThread ? 'yes' : 'no'}`);
                    console.log(`🔍 Available threads:`, rsnVerificationChannel.threads.cache.map(t => t.name).join(', ') || 'none');
                    if (verificationThread) {
                        console.log(`📨 Found existing verification thread for ${user.username} - ephemeral reply will be sent`);
                    } else {
                        console.log(`⚠️ No existing verification thread found for ${user.username} - this shouldn't happen if they joined properly`);
                    }
                } else {
                    console.log(`⚠️ rsn-verification channel not found`);
                }
            }
        } catch (error) {
            console.error(`❌ Error finding verification thread:`, error);
        }
        moveUnprocessedToPending(rsn, user.id);
        const adminChannelId = process.env.ADMIN_CHANNEL_ID;
        console.log(`🔍 Admin Channel ID from env: "${adminChannelId}"`);
        console.log(`🔍 Interaction guild: ${interaction.guild ? interaction.guild.name : 'null'}`);
        let adminChannel = null;
        let targetGuild = interaction.guild;
        if (!targetGuild) {
            targetGuild = interaction.client.guilds.cache.find(g => g.members.cache.has(user.id));
            console.log(`🔍 Found guild via user lookup for admin notification: ${targetGuild ? targetGuild.name : 'null'}`);
        }
        if (targetGuild && adminChannelId) {
            adminChannel = targetGuild.channels.cache.get(adminChannelId);
            console.log(`🔍 Found admin channel: ${adminChannel ? `#${adminChannel.name}` : 'null'}`);
            console.log(`🔍 Guild channels available:`, targetGuild.channels.cache.map(ch => `${ch.name} (${ch.id})`).slice(0, 5).join(', '));
        } else {
            console.log(`❌ Missing guild (${!!targetGuild}) or admin channel ID (${!!adminChannelId})`);
        }
        if (adminChannel) {
            try {
                const notificationEmbed = new EmbedBuilder()
                    .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                    .setTitle('🔍 New RSN Verification Request')
                    .addFields(
                        { name: 'RSN', value: rsn, inline: true },
                        { name: 'Team', value: team.charAt(0).toUpperCase() + team.slice(1), inline: true },
                        { name: 'Discord User', value: `${user.tag}\n<@${user.id}>`, inline: true },
                        { name: 'User ID', value: user.id, inline: true },
                        { name: 'Joined Server', value: member ? member.joinedAt.toLocaleString() : 'Unknown', inline: true },
                        { name: 'Manual Command', value: `\`!approve ${user.id}\``, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({
                        text: 'Bingo Bot • Click button to approve or use manual command'
                    })
                    .setTimestamp();
                const approveButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`approve_${user.id}`)
                            .setLabel(`Approve ${rsn}`)
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                    );
                await adminChannel.send({
                    embeds: [notificationEmbed],
                    components: [approveButton]
                });
                console.log(`✅ Sent admin notification with approve button for ${user.tag} to #${adminChannel.name}`);
            } catch (error) {
                console.error(`❌ Failed to send admin notification:`, error);
            }
        } else {
            console.log(`❌ Admin channel not found with ID: ${adminChannelId}`);
            console.log(`Available channels:`, interaction.guild?.channels.cache.map(ch => `${ch.name} (${ch.id})`).join(', ') || 'None');
        }
        const successEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('✅ Verification Request Submitted')
            .setDescription('Your RSN verification request has been submitted for admin review.')
            .addFields(
                {
                    name: '📋 What happens next:',
                    value: `• Your RSN "${rsn}" has been found in our system\n• You will be assigned to team **${team.charAt(0).toUpperCase() + team.slice(1)}**\n• An admin will review and approve your request\n• You will receive a notification when approved`,
                    inline: false
                },
                {
                    name: '⏳ Please wait',
                    value: 'Admins will review your request as soon as possible.',
                    inline: false
                }
            )
            .setFooter({
                text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)}`
            })
            .setTimestamp();
        await interaction.editReply({ embeds: [successEmbed] });
        console.log(`📝 Added ${user.tag} to pending verification for RSN: ${rsn} (team: ${team})`);
    } catch (error) {
        console.error('Error in RSN verification:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Verification Error')
            .setDescription('An error occurred while processing your verification. Please try again or contact an admin.')
            .setFooter({
                text: 'Bingo Bot • Error occurred'
            });
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}
async function handleApproveButton(interaction) {
    const { PermissionFlagsBits } = require('discord.js');
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to approve users.',
            flags: 64
        });
    }
    await interaction.deferUpdate();
    const userId = interaction.customId.replace('approve_', '');
    console.log(`🔘 Admin ${interaction.user.tag} clicked approve button for user ID: ${userId}`);
    try {
        const { addUserToTeam, removePendingUser, findPendingUser } = require('../utils/config');
        const pendingUser = findPendingUser(userId);
        if (!pendingUser) {
            return await interaction.editReply({
                content: '❌ No pending signup found for that user.'
            });
        }
        const targetUser = await interaction.client.users.fetch(userId);
        const normalizedTeam = pendingUser.team.toLowerCase().trim();
        addUserToTeam(pendingUser.username, normalizedTeam, userId);
        removePendingUser(userId);
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
            }
        } catch (error) {
            console.error('Error marking user as processed in Google Sheets:', error);
        }
        const roleId = normalizedTeam === 'melon' ? process.env.MELON_ROLE_ID : process.env.WEENOR_ROLE_ID;
        const role = interaction.guild.roles.cache.get(roleId);
        const member = interaction.guild.members.cache.get(userId);
        if (role && member) {
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(role);
                console.log(`✅ Added ${normalizedTeam} role to ${targetUser.tag}`);
            }
            const threadName = `${targetUser.username}-verification`;
            const rsnVerificationChannel = interaction.guild.channels.cache.find(channel =>
                channel.type === 0 && channel.name === 'rsn-verification'
            );
            let verificationThread = null;
            if (rsnVerificationChannel) {
                await rsnVerificationChannel.threads.fetchActive();
                await rsnVerificationChannel.threads.fetchArchived();
                console.log(`🔍 Looking for thread: "${threadName}"`);
                console.log(`🔍 Available threads:`, rsnVerificationChannel.threads.cache.map(t => t.name).join(', '));
                verificationThread = rsnVerificationChannel.threads.cache.find(thread =>
                    thread.name === threadName
                );
                if (!verificationThread) {
                    console.log(`⚠️ Exact thread name not found, searching for threads containing user...`);
                    verificationThread = rsnVerificationChannel.threads.cache.find(thread =>
                        thread.name.includes(targetUser.username) ||
                        thread.members.cache.has(userId)
                    );
                    if (verificationThread) {
                        console.log(`✅ Found alternative thread: "${verificationThread.name}"`);
                    }
                }
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
                        content: `<@${userId}>`,
                        embeds: [closingEmbed]
                    });
                    console.log(`⏰ Setting 10-second timer to archive thread: ${verificationThread.name}`);
                    const threadToClose = verificationThread;
                    const userTag = targetUser.tag;
                    setTimeout(async () => {
                        try {
                            console.log(`🗂️ Attempting to remove user and archive thread: ${threadToClose.name} for ${userTag}`);
                            try {
                                await threadToClose.members.remove(userId);
                                console.log(`👤 Removed user ${userTag} from thread ${threadToClose.name}`);
                            } catch (removeError) {
                                console.error(`⚠️ Could not remove user from thread:`, removeError.message);
                            }
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
        const approvedEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ User Approved!')
            .setDescription(`${pendingUser.username} has been approved and added to team ${normalizedTeam.charAt(0).toUpperCase() + normalizedTeam.slice(1)}.`)
            .addFields(
                { name: 'RSN', value: pendingUser.username, inline: true },
                { name: 'Team', value: normalizedTeam.charAt(0).toUpperCase() + normalizedTeam.slice(1), inline: true },
                { name: 'Approved By', value: interaction.user.tag, inline: true }
            )
            .setFooter({
                text: 'Bingo Bot • Approval Complete'
            })
            .setTimestamp();
        const disabledButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`approved_${userId}`)
                    .setLabel('Approved')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✅')
                    .setDisabled(true)
            );
        await interaction.editReply({
            embeds: [approvedEmbed],
            components: [disabledButton]
        });
        console.log(`✅ ${interaction.user.tag} approved ${targetUser.tag} via button click`);
    } catch (error) {
        console.error('Error in button approval:', error);
        try {
            await interaction.editReply({
                content: '❌ An error occurred while approving the user.'
            });
        } catch (editError) {
            console.error('Failed to edit reply:', editError);
            try {
                await interaction.followUp({
                    content: '❌ An error occurred while approving the user.',
                    flags: 64
                });
            } catch (followUpError) {
                console.error('Failed to send followup:', followUpError);
            }
        }
    }
}
async function handleBingoApproveButton(interaction) {
    const { PermissionFlagsBits } = require('discord.js');
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to approve bingo submissions.',
            flags: 64
        });
    }
    await interaction.deferUpdate();
    const submissionId = interaction.customId.replace('bingo_approve_', '');
    console.log(`🎯 Admin ${interaction.user.tag} clicked bingo approve button for submission ID: ${submissionId}`);
    try {
        const { approveSubmission, getPendingSubmissions } = require('../utils/bingo');
        const pendingSubmissions = getPendingSubmissions();
        const submissionData = pendingSubmissions.find(sub => sub.submission.id === submissionId);
        if (!submissionData) {
            return await interaction.editReply({
                content: `❌ No pending submission found with ID: ${submissionId}`
            });
        }
        const { team, coordinate, submission, tile } = submissionData;
        const result = approveSubmission(team, coordinate, submissionId);
        const { tileCompleted, newTotalPoints, progress } = result;
        const bingoChannelId = team === 'melon' ?
            (process.env.MELON_BINGO_CHANNEL_ID || '1422616740197695619') :
            (process.env.WEENOR_BINGO_CHANNEL_ID || '1422616765199945820');
        const bingoChannel = interaction.guild?.channels.cache.get(bingoChannelId);
        console.log(`🎯 Looking for bingo channel for ${team}: ${bingoChannelId}`);
        console.log(`🎯 Found bingo channel: ${bingoChannel ? `#${bingoChannel.name}` : 'null'}`);
        if (bingoChannel) {
            try {
                let notificationEmbed;
                if (tileCompleted) {
                    notificationEmbed = new EmbedBuilder()
                        .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                        .setTitle('🎉 TILE COMPLETED!')
                        .setDescription(`**${submission.submitterRSN}** has completed tile **${coordinate.toUpperCase()}** with **${submission.itemName}**!`)
                        .addFields(
                            { name: '🏆 Points Added', value: `+${tile.points} points`, inline: true },
                            { name: '📊 Team Total', value: `${newTotalPoints} points`, inline: true },
                            { name: '👤 Completed By', value: submission.submitterRSN, inline: true },
                            { name: '🎯 Tile Details', value: `${coordinate.toUpperCase()} (${tile.points} point tile)`, inline: false }
                        )
                        .setFooter({
                            text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)} Submissions`
                        })
                        .setTimestamp();
                } else {
                    notificationEmbed = new EmbedBuilder()
                        .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                        .setTitle('📈 Tile Progress Update!')
                        .setDescription(`**${submission.submitterRSN}** has made progress towards completing tile **${coordinate.toUpperCase()}** with **${submission.itemName}**`)
                        .addFields(
                            { name: '📈 Progress', value: progress.description, inline: true },
                            { name: '📊 Team Total', value: `${newTotalPoints} points`, inline: true },
                            { name: '👤 Submitted By', value: submission.submitterRSN, inline: true },
                            { name: '🎯 Tile Details', value: `${coordinate.toUpperCase()} (${tile.points} point tile when completed)`, inline: false }
                        )
                        .setFooter({
                            text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)} Submissions`
                        })
                        .setTimestamp();
                }
                await bingoChannel.send({ embeds: [notificationEmbed] });
                console.log(`✅ Sent bingo progress notification to ${team} submissions channel`);
            } catch (error) {
                console.error(`❌ Failed to send team notification:`, error);
            }
        }
        try {
            const submitter = await interaction.client.users.fetch(submission.submittedBy);
            const dmEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Bingo Submission Approved!')
                .setDescription(`Your submission has been approved!`)
                .addFields(
                    { name: 'Item', value: submission.itemName, inline: true },
                    { name: 'Tile', value: `${coordinate.toUpperCase()} (${tile.points} points)`, inline: true },
                    { name: 'Status', value: tileCompleted ? '🎉 Tile Completed!' : '📈 Progress Made', inline: true },
                    { name: 'Team Points', value: `${newTotalPoints} total`, inline: false }
                )
                .setFooter({
                    text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)}`
                })
                .setTimestamp();
            await submitter.send({ embeds: [dmEmbed] });
            console.log(`✅ Sent approval DM to ${submission.submitterRSN}`);
        } catch (error) {
            console.error(`❌ Failed to send approval DM:`, error.message);
        }
        const approvedEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Bingo Submission Approved!')
            .setDescription(`**${submission.submitterRSN}** submission approved for tile **${coordinate.toUpperCase()}**`)
            .addFields(
                { name: 'Team', value: team.charAt(0).toUpperCase() + team.slice(1), inline: true },
                { name: 'Result', value: tileCompleted ? '🎉 Tile Completed!' : '📈 Progress Made', inline: true },
                { name: 'Team Points', value: `${newTotalPoints} total`, inline: true }
            );
        if (submission.similarity && submission.similarity < 1) {
            approvedEmbed.addFields(
                { name: '📝 User Typed', value: `"${submission.originalInput}"`, inline: true },
                { name: '🎯 Approved As', value: `"${submission.itemName}"`, inline: true },
                { name: '📊 Match %', value: `${Math.round(submission.similarity * 100)}%`, inline: true }
            );
        } else {
            approvedEmbed.addFields(
                { name: '🎯 Item', value: submission.itemName, inline: true }
            );
        }
        approvedEmbed.addFields(
            { name: 'Approved By', value: interaction.user.tag, inline: true }
        )
        .setFooter({
            text: 'Bingo Bot • Approval Complete'
        })
        .setTimestamp();
        const disabledButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`bingo_approved_${submissionId}`)
                    .setLabel('Approved')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✅')
                    .setDisabled(true)
            );
        await interaction.editReply({
            embeds: [approvedEmbed],
            components: [disabledButton]
        });
        console.log(`✅ ${interaction.user.tag} approved bingo submission ${submissionId} via button click`);
    } catch (error) {
        console.error('Error in bingo button approval:', error);
        try {
            await interaction.editReply({
                content: '❌ An error occurred while approving the bingo submission.'
            });
        } catch (editError) {
            console.error('Failed to edit reply:', editError);
        }
    }
}