const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        console.log(`👋 New member joined: ${member.user.tag}`);
        const guild = member.guild;
        const rsnVerificationChannel = guild.channels.cache.find(channel =>
            channel.type === 0 && channel.name === 'rsn-verification'
        );
        if (rsnVerificationChannel) {
            try {
                const botPermissions = rsnVerificationChannel.permissionsFor(guild.members.me);
                console.log(`🔍 Creating immediate verification thread for ${member.user.tag}`);
                console.log(`   - CREATE_PRIVATE_THREADS: ${botPermissions.has('CreatePrivateThreads')}`);
                let verificationThread;
                if (botPermissions.has('CreatePrivateThreads')) {
                    verificationThread = await rsnVerificationChannel.threads.create({
                        name: `${member.user.username}-verification`,
                        autoArchiveDuration: 1440, 
                        type: 12, 
                        invitable: false,
                        reason: `Private verification thread for ${member.user.tag}`
                    });
                    console.log(`✅ Created PRIVATE verification thread for ${member.user.tag}`);
                } else {
                    verificationThread = await rsnVerificationChannel.threads.create({
                        name: `${member.user.username}-verification`,
                        autoArchiveDuration: 1440, 
                        type: 11, 
                        reason: `Verification thread for ${member.user.tag} (no private thread permission)`
                    });
                    console.log(`⚠️ Created PUBLIC verification thread for ${member.user.tag} (missing private thread permission)`);
                }
                await verificationThread.members.add(member.user.id);
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🎉 Welcome to the Bingo Server!')
                    .setDescription(`Welcome ${member}! This is your private verification thread. To complete your registration and get access to your team channels, please verify your RSN.`)
                    .addFields(
                        {
                            name: '📋 Instructions',
                            value: '1. Click the "Verify RSN" button below\n2. Enter your RSN in the modal that opens\n3. Wait for admin approval\n4. You will be automatically assigned to your team',
                            inline: false
                        },
                        {
                            name: '🔒 Privacy',
                            value: verificationThread.type === 12 ? 'This thread is private - only you and admins can see it.' : 'This is your dedicated verification thread.',
                            inline: false
                        },
                        {
                            name: '❓ Need Help?',
                            value: 'Contact an admin if you have any issues with verification.',
                            inline: false
                        }
                    )
                    .setFooter({
                        text: 'Bingo Bot • Click the button below to verify'
                    })
                    .setTimestamp();
                const verifyButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('verify_rsn')
                            .setLabel('Verify RSN')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('✅')
                    );
                await verificationThread.send({
                    content: `${member}`,
                    embeds: [welcomeEmbed],
                    components: [verifyButton]
                });
                console.log(`📨 Created verification thread and sent welcome message to ${member.user.tag}`);
            } catch (error) {
                console.error(`❌ Failed to create verification thread for ${member.user.tag}:`, error);
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('🎉 Welcome to the Bingo Server!')
                        .setDescription('Welcome! There was an issue creating your verification thread. Please contact an admin.')
                        .setFooter({ text: 'Bingo Bot • Contact Admin' });
                    await member.send({ embeds: [dmEmbed] });
                    console.log(`📨 Sent fallback DM to ${member.user.tag}`);
                } catch (dmError) {
                    console.error(`❌ Could not send DM either:`, dmError);
                }
            }
        } else {
            console.log(`❌ rsn-verification channel not found for ${member.user.tag}`);
        }
    },
};