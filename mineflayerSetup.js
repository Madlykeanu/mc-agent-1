const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const payloadBuilder = require('./payloadBuilder');
const readline = require('readline');
// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let bot = mineflayer.createBot({
    host: 'play.earthvision.eu',
    //host: 'play.ccnetmc.com', // Minecraft server IP
    port: 25565,       // server port, 25565 by default
    username: 'madlykeanu@gmail.com', // Your Mojang or Microsoft account email
    auth: 'microsoft', // Use 'mojang' for Mojang accounts, 'microsoft' for Microsoft accounts
    version: '1.20.2'
  });

// Listen for the spawn event
bot.on('spawn', () => {
    // Wait 2 seconds before sending the command to change server
    setTimeout(() => {
        bot.chat('/server phoenix');
    }, 2000);
});

let messageCount = 0; // Initialize message counter

// Listen for chat messages
bot.on('chat', async (username, message) => {
    console.log(`Message from ${username}: ${message}`); // Add this line for debugging// Ignore messages from the bot itself
    if (username === bot.username) return;
    
    console.log(`Message from ${username}: ${message}`); // Add this line for debugging// Ignore messages from the bot itself
  
    // Increment the message counter
    messageCount++;

    // Check if 3 messages have been received
    if (messageCount >= 5) {
        // Reset the message counter
       

        // Construct the payload according to the curl example
        const payload = {
          messages: [
            { role: 'system', content: 'your playing on a minecraft server with your bros and you cant stop telling everyone how epic and thicc shrek is. keep responses very short. dont use expressions like *winks* *roars* etc' },
            { role: 'user', content: message } // Use the actual message received from chat
          ],
          temperature: 0.7,
          max_tokens: -1,
          stream: false
        };
  
        try {
          // Send the POST request with the constructed payload
          const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload);
          //console.log(response); // Log the response for debugging
  
          // Here's where you should place the provided code snippet
          if (response.choices && response.choices.length > 0 && response.choices[0].message) {
              const messageContent = response.choices[0].message.content;
              if (messageContent) {
                  const responseText = messageContent.trim();
                  // Delay sending the response by 4 seconds
                  setTimeout(() => {
                      bot.chat(responseText);
                      console.log(`Bot response: ${responseText}`); // Add this line to print the bot's response
                  }, 2000);
              } else {
                  console.error('Message content is undefined');
              }
          } else {
              console.error('Invalid response structure:', response);
          }
        } catch (error) {
          console.error('Error handling chat message:', error);
          bot.chat("Oops, I ran into an issue trying to respond.");
        }
    }
});

// Setup readline interface for terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Listen for terminal input and send as chat messages
rl.on('line', (line) => {
  bot.chat(line);
});

console.log('Mineflayer bot setup complete. Type in the terminal to send messages in-game.');
