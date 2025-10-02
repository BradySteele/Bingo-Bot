module.exports = {
    name: 'presenceUpdate',
    async execute(oldPresence, newPresence) {
        if (!newPresence || !newPresence.member) return;
        
        const member = newPresence.member;
        const guild = member.guild;
        
        const liveStreamerRoleId = '1423369409568833566';
                
        const liveStreamerRole = guild.roles.cache.get(liveStreamerRoleId);
        if (!liveStreamerRole) {
            console.log('⚠️ Currently Live role not found in server');
            return;
        }
        
        const streamAnnouncementsChannelId = '1423372199821180958';
        const streamAnnouncementsChannel = guild.channels.cache.get(streamAnnouncementsChannelId);
        
        const isStreaming = newPresence.activities.some(activity =>
            activity.type === 1
        );
        
        const wasStreaming = oldPresence ? oldPresence.activities.some(activity =>
            activity.type === 1
        ) : false;
        
        const streamingActivity = newPresence.activities.find(activity => activity.type === 1);
        
        try {
            if (isStreaming && !wasStreaming) {
                if (!member.roles.cache.has(liveStreamerRoleId)) {
                    await member.roles.add(liveStreamerRole);
                    console.log(`🔴 Added Currently Live role to ${member.user.tag} - streaming: ${streamingActivity?.name || 'Unknown'}`);
                    console.log(`📺 Stream URL: ${streamingActivity?.url || 'No URL'}`);
                }
                
                if (streamAnnouncementsChannel && streamingActivity) {
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
                        await streamAnnouncementsChannel.send({
                            content: `🔴 **LIVE NOW!** ${member}`,
                            embeds: [streamEmbed]
                        });
                        console.log(`📢 Posted stream announcement for ${member.user.tag} in ${streamAnnouncementsChannel.name}`);
                    } catch (announcementError) {
                        console.error(`❌ Failed to post stream announcement:`, announcementError.message);
                    }
                } else if (!streamAnnouncementsChannel) {
                    console.log('⚠️ Stream announcements channel not found');
                }
            }
            
            if (!isStreaming && wasStreaming) {
                if (member.roles.cache.has(liveStreamerRoleId)) {
                    await member.roles.remove(liveStreamerRole);
                    console.log(`⚫ Removed Currently Live role from ${member.user.tag} - stopped streaming`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error managing Currently Live role for ${member.user.tag}:`, error.message);
        }
    },
};