const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadConfig } = require('../utils/config');
module.exports = {
    name: 'status',
    description: 'Check system status and statistics',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        try {
            const config = loadConfig();
            const melonCount = Object.keys(config.melon || {}).length;
            const weeorCount = Object.keys(config.weenor || {}).length;
            const pendingCount = (config.pending || []).length;
            const envStatus = {
                discordToken: !!process.env.DISCORD_TOKEN,
                guildId: !!process.env.GUILD_ID,
                adminChannel: !!process.env.ADMIN_CHANNEL_ID,
                googleSheets: !!process.env.GOOGLE_SHEETS_ID,
                serviceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                privateKey: !!process.env.GOOGLE_PRIVATE_KEY,
                melonRole: !!process.env.MELON_ROLE_ID,
                weeorRole: !!process.env.WEENOR_ROLE_ID
            };
            const configuredCount = Object.values(envStatus).filter(Boolean).length;
            const totalEnvVars = Object.keys(envStatus).length;
            const guild = message.guild;
            const memberCount = guild.memberCount;
            let sheetsStatus = '❌ Not connected';
            try {
                const { setupGoogleSheets } = require('../utils/googleSheets');
                await setupGoogleSheets();
                sheetsStatus = '✅ Connected';
            } catch (error) {
                sheetsStatus = `❌ Error: ${error.message.substring(0, 50)}...`;
            }
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📊 System Status')
                .setDescription('Current status of the Bingo Bot system')
                .addFields(
                    {
                        name: '👥 User Statistics',
                        value: `**Team Melon:** ${melonCount} members\n**Team Weenor:** ${weeorCount} members\n**Pending Approval:** ${pendingCount} users\n**Total Server Members:** ${memberCount}`,
                        inline: true
                    },
                    {
                        name: '⚙️ Configuration',
                        value: `**Environment Variables:** ${configuredCount}/${totalEnvVars} configured\n**Google Sheets:** ${sheetsStatus}\n**Bot Status:** ${client.user.presence?.status || 'online'}`,
                        inline: true
                    },
                    {
                        name: '🔧 Environment Check',
                        value: Object.entries(envStatus)
                            .map(([key, value]) => `${value ? '✅' : '❌'} ${key}`)
                            .join('\n'),
                        inline: false
                    },
                    {
                        name: '🤖 Bot Info',
                        value: `**Uptime:** ${Math.floor(client.uptime / 1000 / 60)} minutes\n**Servers:** ${client.guilds.cache.size}\n**Commands:** ${client.commands.size}`,
                        inline: true
                    },
                    {
                        name: '📈 Performance',
                        value: `**Memory Usage:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n**Node Version:** ${process.version}\n**Discord.js:** ${require('discord.js').version}`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Bingo Bot • Last updated`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTimestamp();
            if (configuredCount < totalEnvVars) {
                embed.setColor(0xFFA500); 
                embed.addFields({
                    name: '⚠️ Configuration Warning',
                    value: 'Some environment variables are missing. Check your `.env` file and ensure all required variables are set.',
                    inline: false
                });
            }
            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in status command:', error);
            await message.reply('❌ An error occurred while checking system status.');
        }
    }
};