const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const readline = require('readline');
// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let bot = mineflayer.createBot({
    host: '2b2t.org', // Minecraft server IP
    port: 25565,       // server port, 25565 by default
    username: 'madlykeanu@gmail.com', // Your Mojang or Microsoft account email
    auth: 'microsoft', // Use 'mojang' for Mojang accounts, 'microsoft' for Microsoft accounts
    version: '1.20.2'
});

// Flag to determine if the bot should respond to messages
let canRespondToMessages = false;
let ignoreNextPpmomentMessage = true;

// Store the last messages sent by the bot
let lastSentMessages = [];

// Listen for the spawn event
bot.on('spawn', () => {
    // Wait 5 seconds before allowing the bot to respond to messages
    setTimeout(() => {
        canRespondToMessages = true;
    }, 10000);
});

// Listen for chat messages using 'message' event
bot.on('message', async (jsonMsg) => {
    console.log(`Received message: ${jsonMsg.toString()}`); // Print all messages to console

    // If the bot is not allowed to respond to messages yet, return early
    if (!canRespondToMessages) return;

    const message = jsonMsg.toString();

    // Check if the message includes 'ppmoment'
    if (!message.includes('ppmoment')) {
        // If it doesn't, do not process this message further
        return;
    }

    // Check if the message is from the bot itself by looking for "ppmoment:" or "<ppmoment>"
    if (message.includes('ppmoment:') || message.includes('<ppmoment>')) {
      // If it is, do not process this message further
      return;
  }

    // Check if the message is one the bot has sent recently
    if (lastSentMessages.includes(message)) {
        // If it is, remove it from the array and do not respond
        lastSentMessages = lastSentMessages.filter(m => m !== message);
        return;
    }

    // Construct the payload for every message received
    const payload = {
        messages: [
            { role: 'system', content: 'your name is ppmoment, your playing on a minecraft server called earthvision with your bros.you love the server very much. keep responses short. dont use emojis' },
            { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500,
        stream: false
    };

    try {
        // Send the POST request with the constructed payload
        const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload);

        if (response.choices && response.choices.length > 0 && response.choices[0].message) {
                       const messageContent = response.choices[0].message.content;
            if (messageContent) {
                const responseText = messageContent.trim();
                // Delay sending the response by 3 seconds
                setTimeout(() => {
                    bot.chat(responseText);
                    console.log(`Bot response: ${responseText}`); // Add this line to print the bot's response
                    // Add the message to the array of last sent messages
                    lastSentMessages.push(responseText);
                    // Optionally, limit the size of the array to the last X messages
                    if (lastSentMessages.length > 10) { // for example, keep only last 10 messages
                        lastSentMessages.shift(); // remove the oldest message
                    }
                }, 3000);
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
