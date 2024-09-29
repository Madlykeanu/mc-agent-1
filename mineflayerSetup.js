const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const readline = require('readline');
const { buildPayload } = require('./payloadBuilder');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')); 

let bot = mineflayer.createBot(config.bot);

// Flags and tracking variables
let canRespondToMessages = false;
let ignoreNextPpmomentMessage = true;
let lastMentionedPlayers = {}; // Track mentions
let lastSentMessages = []; // Track the last 10 messages sent by the bot
let respondToMentionsOnly = true; 
let respondToAllMessages = true; // Enables response to all messages
let lastMessageTime = 0; // Timestamp of the last message sent

// Initialize the message history array
let messageHistory = [];

// Listen for the spawn event
bot.on('spawn', () => {
    setTimeout(() => {
        canRespondToMessages = true;
    }, 10000);
    ignoreNextPpmomentMessage = true; // Reset the flag on spawn
});

bot.on('message', async (jsonMsg) => {
    if (!canRespondToMessages) return;

    const message = jsonMsg.toString();
    const timestamp = new Date().toISOString();
    const timedMessage = `[${timestamp}] - ${message}`;
    console.log(`Added message to history: ${timedMessage}`);

    // **Update message history with every message received**
    messageHistory.push(timedMessage);
    if (messageHistory.length > 50) {
        messageHistory.shift();
    }

    if (respondToAllMessages) {
        processMessage(message);
        return; // Continue to ensure message history is updated
    }

    const playerName = extractPlayerName(message);
    console.log(`Received message from ${playerName}: ${message}`);

    // Check if the message mentions 'pp' or if respondToAllMessages is true
    if (message.toLowerCase().includes('pp') || respondToAllMessages) {
        await processMessage(message);
    }
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

    // Check against the last 10 messages sent by the bot
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

// Add this function to handle tool usage
function handleToolUsage(tool, args) {
    switch (tool) {
        case '/tpa':
            if (args) {
                bot.chat(`/tpa ${args}`);
                return null;
            }
            return "Error: Missing player name for /tpa command";
        case '/tpaccept':
            bot.chat('/tpaccept');
            return null;
        default:
            return `Error: Unknown tool command ${tool}`;
    }
}

async function processMessage(message) {
    console.log(`Processing message: ${message}`);

    // Check if the message contains 'ppmoment' or 'ppmoment:' and skip processing if it does
    if (message.toLowerCase().includes('<ppmoment>') || message.includes('ppmoment:')) {
        console.log('Skipping response to prevent responding to messages containing "<ppmoment>" or "ppmoment:".');
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

    // **Use the buildPayload function from payloadBuilder.js**
    const payload = buildPayload(message, messageHistory.join('\n'));

    try {
        const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload);

        if (response.choices && response.choices.length > 0 && response.choices[0].message) {
            let messageContent = response.choices[0].message.content.trim();
            
            try {
                // Try to parse the response as JSON
                const jsonResponse = JSON.parse(messageContent);
                
                // Log the AI's thought process
                console.log(`AI Thought: ${jsonResponse.thought}`);

                // Check if the AI decided to respond
                if (!jsonResponse.shouldRespond) {
                    console.log('AI decided not to respond to this message.');
                    return;
                }

                if (jsonResponse.tool) {
                    // Handle tool usage without assigning the result to messageContent
                    const toolResult = handleToolUsage(jsonResponse.tool, jsonResponse.args);
                    if (toolResult && toolResult.startsWith("Error:")) {
                        console.error(toolResult);
                        return;
                    }
                    // Use the AI's message if provided, otherwise don't send anything
                    messageContent = jsonResponse.message || null;
                } else {
                    // If no tool is used, just use the message
                    messageContent = jsonResponse.message;
                }
            } catch (error) {
                // If parsing fails, assume it's a regular message
                console.log('Response is not in JSON format, treating as regular message');
            }

            if (messageContent) {
                // Delay sending the response by 3 seconds
                setTimeout(() => {
                    bot.chat(messageContent);
                    console.log(`Bot response: ${messageContent}`);
                    // Track the sent message to prevent responding to it again
                    trackSentMessage(messageContent);
                }, 3000);
            } else {
                console.log('No message to send after tool usage or AI decided not to respond.');
            }
        } else {
            console.error('Invalid response structure:', response);
        }
    } catch (error) {
        console.error('Error handling chat message:', error);
        bot.chat("Oops, I ran into an issue trying to respond.");
    }
}