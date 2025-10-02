const { initializeProcessedColumn } = require('../utils/googleSheets');
module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Discord bot is ready! Logged in as ${client.user.tag}`);
        console.log(`🏠 Connected to ${client.guilds.cache.size} server(s)`);
        try {
            await initializeProcessedColumn();
            console.log('✅ Google Sheets integration initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets:', error.message);
        }
        client.user.setActivity('for new signups', { type: 'WATCHING' });
        
        setTimeout(() => checkExistingStreamers(client), 5000);
    },
};

const checkExistingStreamers = async (client) => {
    console.log('🔍 Checking for existing streamers on startup...');
    
    const liveStreamerRoleId = '1423369409568833566';
    const streamAnnouncementsChannelId = '1423372199821180958';
    
    for (const guild of client.guilds.cache.values()) {
        const liveRole = guild.roles.cache.get(liveStreamerRoleId);
        const announceChannel = guild.channels.cache.get(streamAnnouncementsChannelId);
        
        if (!liveRole) {
            console.log(`⚠️ Currently Live role not found in server ${guild.name}`);
            continue;
        }
        
        if (!announceChannel) {
            console.log(`⚠️ Stream announcements channel not found in server ${guild.name}`);
            continue;
        }
        
        for (const member of guild.members.cache.values()) {
            if (!member.presence) continue;
            
            const isStreaming = member.presence.activities.some(activity => activity.type === 1);
            const streamingActivity = member.presence.activities.find(activity => activity.type === 1);
            
            if (isStreaming && !member.roles.cache.has(liveStreamerRoleId)) {
                try {
                    console.log(`🔴 Found existing streamer: ${member.user.tag} - adding role and posting announcement`);
                    
                    await member.roles.add(liveRole);
                    console.log(`🔴 Added Currently Live role to ${member.user.tag} - streaming: ${streamingActivity?.name || 'Unknown'}`);
                    
                    if (streamingActivity) {
                        const streamUrl = streamingActivity.url || '';
                        const streamTitle = streamingActivity.name || 'Unknown Stream';
                        const streamDetails = streamingActivity.details || '';
                        const streamState = streamingActivity.state || '';
                        
                        let platform = '🔴 Live';
                        let platformColor = 0x9146FF;
                        
                        if (streamUrl.includes('twitch.tv')) {
                            platform = '🟣 Twitch';
                            platformColor = 0x9146FF;
                        } else if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
                            platform = '🔴 YouTube';
                            platformColor = 0xFF0000;
                        }
                        
                        const streamEmbed = {
                            color: platformColor,
                            title: `${platform} Stream Started!`,
                            description: `${member} is now live!`,
                            fields: [
                                { name: '🎮 Game/Category', value: streamTitle, inline: true },
                                { name: '👤 Streamer', value: member.displayName || member.user.username, inline: true },
                                { name: '🔗 Watch Now', value: streamUrl ? `[Click here to watch!](${streamUrl})` : 'No URL available', inline: false }
                            ],
                            thumbnail: {
                                url: member.user.displayAvatarURL({ dynamic: true, size: 256 })
                            },
                            footer: {
                                text: 'Bingo Bot • Stream Notifications',
                                icon_url: guild.iconURL({ dynamic: true })
                            },
                            timestamp: new Date().toISOString()
                        };
                        
                        if (streamDetails) {
                            streamEmbed.fields.push({ name: '📝 Title', value: streamDetails, inline: false });
                        }
                        if (streamState) {
                            streamEmbed.fields.push({ name: '🎯 Status', value: streamState, inline: true });
                        }
                        
                        try {
                            await announceChannel.send({
                                content: `🔴 **LIVE NOW!** ${member}`,
                                embeds: [streamEmbed]
                            });
                            console.log(`📢 Posted startup stream announcement for ${member.user.tag} in ${announceChannel.name}`);
                        } catch (announcementError) {
                            console.error(`❌ Failed to post startup stream announcement:`, announcementError.message);
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing existing streamer ${member.user.tag}:`, error.message);
                }
            }
        }
    }
    
    console.log('✅ Finished checking for existing streamers');
};