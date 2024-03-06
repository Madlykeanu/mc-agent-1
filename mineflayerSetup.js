const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const payloadBuilder = require('./payloadBuilder');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let bot = mineflayer.createBot({
    host: 'localhost', // Minecraft server IP
    port: 25565,       // server port, 25565 by default
    username: 'madlykeanu@gmail.com', // Your Mojang or Microsoft account email
    //password: 'AwesomeAwesome11', // Your account password
    auth: 'microsoft' // Use 'mojang' for Mojang accounts, 'microsoft' for Microsoft accounts
  });

// Listen for chat messages
bot.on('chat', async (username, message) => {
    if (username === bot.username) return; // Ignore messages from the bot itself
  
    // Construct the payload according to the curl example
    const payload = {
      messages: [
        { role: 'system', content: 'your playing on a minecraft server, only answer every once in a while, answer like your in the server and chatting with the other players' },
        { role: 'user', content: message } // Use the actual message received from chat
      ],
      temperature: 0.7,
      max_tokens: -1,
      stream: false
    };
  
    try {
      // Send the POST request with the constructed payload
      const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload);
      console.log(response); // Log the response for debugging
  
      // Here's where you should place the provided code snippet
      if (response.choices && response.choices.length > 0 && response.choices[0].message) {
          const messageContent = response.choices[0].message.content;
          if (messageContent) {
              const responseText = messageContent.trim();
              bot.chat(responseText);
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
});

console.log('Mineflayer bot setup complete.');
