function onFormSubmit(e) {
  try {
    // Debug: Log the event object to see what we're getting
    console.log('Event object:', e);
    
    // Get the form response values - try different methods
    let responses;
    
    if (e.values) {
      // Method 1: Direct from event (spreadsheet trigger)
      responses = e.values;
    } else if (e.response) {
      // Method 2: From form response object (form trigger)
      responses = e.response.getItemResponses().map(item => item.getResponse());
      responses.unshift(new Date()); // Add timestamp at beginning
    } else {
      // Method 3: Get from active spreadsheet
      const sheet = SpreadsheetApp.getActiveSheet();
      const lastRow = sheet.getLastRow();
      responses = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    
    console.log('Responses:', responses);
    
    if (!responses || responses.length < 3) {
      throw new Error('Not enough response data');
    }
    
    const timestamp = responses[0]; // Column 1 - Timestamp
    const teamResponse = responses[1]; // Column 2 - Team selection (full sentence)
    const username = responses[2];  // Column 3 - RSN/Username
    const paid = responses[3];      // Column 4 - Payment info
    
    // Extract team from full sentence response
    let team = 'Unknown';
    if (teamResponse && typeof teamResponse === 'string') {
      const teamLower = teamResponse.toLowerCase();
      if (teamLower.includes('melon')) {
        team = 'Melon';
      } else if (teamLower.includes('weenor')) {
        team = 'Weenor';
      } else if (teamLower.includes('back-up')) {
        team = 'Backup List';
      }
    }
  
  const webhookUrl = 'https://discord.com/api/webhooks/1422579543603937313/ePPuASq4DFFyIjH99wKqfqPgJfAsgphupFWzWLLh_uV0M_-KFZJJ0zId5q1H2x9zJgUK';
  
  // Create Discord notification message
  const payload = {
    embeds: [{
      title: '📝 New Bingo Signup!',
      description: `**${username}** signed up for team **${team.charAt(0).toUpperCase() + team.slice(1).toLowerCase()}**`,
      color: team.toLowerCase() === 'melon' ? 9498256 : 16761035, // Green for Melon, Pink for Weenor
      fields: [
        { name: 'RSN', value: username, inline: true },
        { name: 'Team', value: team, inline: true },
        { name: 'Payment', value: paid || 'Not specified', inline: true },
        { name: 'Submitted', value: new Date(timestamp).toLocaleString(), inline: false },
        { name: '⚠️ Action Required', value: 'Run `!sync` to import new signups to bot', inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Google Form • Run !sync to import' }
    }]
  };
  
  // Send notification to Discord
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload)
  };
  
    try {
      UrlFetchApp.fetch(webhookUrl, options);
      console.log(`Discord notification sent for ${username} (${team})`);
    } catch (error) {
      console.error('Error sending Discord notification:', error);
    }
    
  } catch (error) {
    console.error('Error in onFormSubmit:', error);
    console.error('Event object was:', e);
  }
}