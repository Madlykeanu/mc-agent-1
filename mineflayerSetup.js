const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const readline = require('readline');
// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')); 
let bot = mineflayer.createBot({
    host: 'localhost', // Minecraft server IP (change this to your server's IP)
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
let respondToMentionsOnly = false; // False enables response to players within 5s without mention
let respondToAllMessages = false; // Add this flag at the top with other flags
let lastMessageTime = 0; // Initialize with 0 to track the timestamp of the last message sent

// Listen for the spawn event
bot.on('spawn', () => {
    setTimeout(() => {
        canRespondToMessages = true;
    }, 10000);
    ignoreNextPpmomentMessage = true; // Reset the flag on spawn
});

// Initialize the message history array at the top with other flags
let messageHistory = [];


bot.on('message', async (jsonMsg) => {
    if (!canRespondToMessages) return;

    if (respondToAllMessages) {
        processMessage(jsonMsg.toString());
        return; // Return early to skip the rest of the logic
    }

    const message = jsonMsg.toString();

    // Get current timestamp
    const timestamp = new Date().toISOString(); // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ

    // Combine timestamp and message
    const timedMessage = `[${timestamp}] - ${message}`;
    console.log(`added message to history ${timedMessage}`);

    // Update message history with every message received
    messageHistory.push(timedMessage);

    // Limit the message history to the last 100 messages
    if (messageHistory.length > 100) {
        messageHistory.shift(); // Remove the oldest message
    }

    const playerName = extractPlayerName(message);

    console.log(`Received message from ${playerName}: ${message}`);




    const shouldUpdateMentionedPlayers = message.includes('ppmoment') || message.includes('pp');

    if (message.includes('ppmoment:') || message.includes('<ppmoment>') || message.includes('/hub')) {
        return;
    }

    if (ignoreNextPpmomentMessage) {
        ignoreNextPpmomentMessage = false;
        return;
    }

    if (lastSentMessages.includes(message)) {
        console.log('Skipping response to prevent loop/spam.');
        return;
    }

    if (respondToMentionsOnly && !message.includes('ppmoment') && !message.includes('pp')) {
        console.log('Ignoring message as it does not mention ppmoment or pp.');
        return;
    }

    if (shouldUpdateMentionedPlayers || lastMentionedPlayers[playerName]) {
        console.log(`Preparing to respond to ${playerName}`);

        // Construct the message history string
        const messageHistoryString = messageHistory.join(' '); // Or use '\n' for new lines

        const payload = {
            messages: [
                { 
                    role: 'system', 
                    content: `your name is ppmoment. keep responses as short as possible. youre playing on a Minecraft server you love called earthvision. you like to swear occasionally. do NOT use *, quotes, or emojis in your responses.  here are the commands you have access to: ("/tpa {playername}", if a player asks you to tp or teleport to you you can use this), ("/tpaccept", you can use this command to accept a teleport request from another player) ingame chat history for  context(this is for context only): ${messageHistoryString}.`
                },
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
                    if (shouldUpdateMentionedPlayers) {
                        lastMentionedPlayers[playerName] = Date.now();
                        console.log(`Updated lastMentionedPlayers for ${playerName}`);
                    }
                    //waits for 3 seconds before sending the response
                    setTimeout(() => {
                        bot.chat(responseText);
                        console.log(`Bot response: ${responseText}`);
                        trackSentMessage(responseText);
                    }, 0); //this is the delay before sending the response
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
  trackSentMessage(line);
});

console.log('Mineflayer bot setup complete. Type in the terminal to send messages in-game.');

function extractPlayerName(message) {
    let match = message.match(/^<([^>]+)>/);
    if (match) {
        return match[1];
    }

    match = message.match(/\[.*\]\s*([^»]+)\s*»/);
    if (match) {
        return match[1].trim();
    }

    return null;
}

function trackSentMessage(message) {
    lastSentMessages.unshift(message);
    if (lastSentMessages.length > 10) {
        lastSentMessages.pop();
    }
}


function messageEndsMatchLastSent(message) {
    // Extract the last 4 characters of the incoming message
    const incomingMessageEnd = message.slice(-4);

    // Check against the last 5 messages sent by the bot
    for (let i = 0; i < lastSentMessages.length; i++) {
        // Extract the last 4 characters of the current message being checked
        const lastMessageEnd = lastSentMessages[i].slice(-4);

        // Compare the two
        if (incomingMessageEnd === lastMessageEnd) {
            return true; // If any match is found, return true
        }
    }

    // If no match is found after checking all messages, return false
    return false;
}



async function processMessage(message) {
    console.log(`Processing message: ${message}`);

    // Check if the message contains 'ppmoment' or 'ppmoment:' and skip processing if it does
    if (message.toLowerCase().includes('ppmoment') || message.includes('ppmoment:')) {
        console.log('Skipping response to prevent responding to messages containing "ppmoment" or "ppmoment:".');
        return;
    }

    // Check if the incoming message's end matches the end of any of the last sent messages
    if (messageEndsMatchLastSent(message)) {
        console.log('Skipping response to prevent responding to own message.');
        return;
    }

    // Check if 5 seconds have passed since the last message was initiated
    const currentTime = Date.now();
    if (currentTime - lastMessageTime < 5000) { // 5000 milliseconds = 5 seconds
        console.log('Skipping response to maintain a minimum interval of 5 seconds between initiating messages.');
        return;
    }

    // Update the last message time to now, marking the initiation of the POST request
    lastMessageTime = Date.now();
    //you are playing your favourite server wildwood smp. you will talk like a pirate. dont say "ppmoment:" or "ppmoment" in your responses. keep your responses as short as possible
    const payload = {
        messages: [
            { 
                role: 'system', 
                content: `your name is ppmoment. keep responses as short as possible. youre playing on a Minecraft server you love called earthvision. you like to swear occasionally. do NOT use *, quotes, or emojis in your responses.  here are the commands you have access to: ("/tpa {playername}", if a player asks you to tp or teleport to you you can use this), ("/tpaccept", you can use this command to accept a teleport request from another player) ingame chat history for  context(this is for context only): ${messageHistoryString}.`
            },
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
                // Delay sending the response by 3 seconds
                setTimeout(() => {
                    bot.chat(responseText);
                    console.log(`Bot response: ${responseText}`);
                    // Track the sent message to prevent responding to it again
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