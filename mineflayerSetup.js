const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const readline = require('readline');
// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let bot = mineflayer.createBot({
    host: 'play.earthvision.eu', // Minecraft server IP (change this to your server's IP)
    port: 25565,       // server port, 25565 by default
    username: 'madlykeanu@gmail.com', // Your Mojang or Microsoft account email
    auth: 'microsoft', // Use 'mojang' for Mojang accounts, 'microsoft' for Microsoft accounts
    version: '1.20.2'
});

// Flag to determine if the bot should respond to messages
let canRespondToMessages = false;
let ignoreNextPpmomentMessage = true;
let lastMentionedPlayers = {}; // New structure to track mentions
let lastSentMessages = []; // Track the last 5 messages sent by the bot
let respondToMentionsOnly = false; // Set to true to respond only to mentions of 'ppmoment' or 'pp'

// Listen for the spawn event
bot.on('spawn', () => {
    setTimeout(() => {
        canRespondToMessages = true;
    }, 10000);
    ignoreNextPpmomentMessage = true; // Reset the flag on spawn
});

bot.on('message', async (jsonMsg) => {
    //console.log(`Received message: ${jsonMsg.toString()}`); // Print all messages to console

    if (!canRespondToMessages) return;

    const message = jsonMsg.toString();
    const playerName = extractPlayerName(message);

    console.log(`Received message from ${playerName}: ${message}`);

    // Check for mentions and prepare to update lastMentionedPlayers after receiving the response
    const shouldUpdateMentionedPlayers = message.includes('ppmoment') || message.includes('pp');

    // Ignore messages from the bot itself or based on specific keywords
    if (message.includes('ppmoment:') || message.includes('<ppmoment>') || message.includes('/hub')) {
        return;
    }

    if (ignoreNextPpmomentMessage) {
        ignoreNextPpmomentMessage = false;
        return;
    }

    // Skip responding if the message matches one of the last 5 messages sent by the bot
    if (lastSentMessages.includes(message)) {
        console.log('Skipping response to prevent loop/spam.');
        return;
    }

    // Check if we should only respond to mentions, and if the message doesn't contain the keywords, return early
    if (respondToMentionsOnly && !message.includes('ppmoment') && !message.includes('pp')) {
        console.log('Ignoring message as it does not mention ppmoment or pp.');
        return;
    }

    // Only proceed if the player recently mentioned the bot or mentioned it in this message
    if (shouldUpdateMentionedPlayers || lastMentionedPlayers[playerName]) {
        console.log(`Preparing to respond to ${playerName}`);

        const payload = {
            messages: [
                { role: 'system', content: 'your name is ppmoment.  keep responses as short as possibel. your playing on a minecraft server you love called earthvision. you like to swear occasionally. do NOT use *,  quotes, or emojis in your responses.' },
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 500,
            stream: false
        };

        try {
            const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload);

            if (response.choices && response.choices.length > 0 && response.choices[0].message) {
                const messageContent = response.choices[0].message.content;
                if (messageContent) {
                    const responseText = messageContent.trim();
                    // Update lastMentionedPlayers here, after receiving the response
                    if (shouldUpdateMentionedPlayers) {
                        lastMentionedPlayers[playerName] = Date.now();
                        console.log(`Updated lastMentionedPlayers for ${playerName}`);
                    }
                    // Delay sending the response by 3 seconds
                    setTimeout(() => {
                        bot.chat(responseText);
                        console.log(`Bot response: ${responseText}`);
                        // Track the sent message to prevent responding to it
                        trackSentMessage(responseText);
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
    }

    // Cleanup lastMentionedPlayers before checking for response eligibility
    Object.keys(lastMentionedPlayers).forEach(player => {
        if ((Date.now() - lastMentionedPlayers[player]) > 5000) { // 5 seconds have passed
            delete lastMentionedPlayers[player];
            console.log(`Removed ${player} from lastMentionedPlayers due to timeout`);
        }
    });
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  bot.chat(line);
  // Track the sent message to prevent responding to it
  trackSentMessage(line);
});

console.log('Mineflayer bot setup complete. Type in the terminal to send messages in-game.');

function extractPlayerName(message) {
    // First, try to match the format "<PlayerName> message"
    let match = message.match(/^<([^>]+)>/);
    if (match) {
        return match[1];
    }

    // If the first format isn't found, try to match the format "[Prefix] PlayerName » message"
    // Adjust the regex as needed based on the exact format and possible variations
    match = message.match(/\[.*\]\s*([^»]+)\s*»/);
    if (match) {
        return match[1].trim(); // Trim to remove any leading/trailing whitespace
    }

    // Return null if no format matches
    return null;
}
// Function to add a message to the lastSentMessages array and keep only the last 5
function trackSentMessage(message) {
    lastSentMessages.push(message);
    // Keep only the last 5 messages
    if (lastSentMessages.length > 5) {
        lastSentMessages.shift(); // Remove the oldest message
    }
}
