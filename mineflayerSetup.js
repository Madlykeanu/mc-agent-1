const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const readline = require('readline');
const { buildPayload, addNewTool } = require('./payloadBuilder');

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

// New variables for message batching
let newMessages = [];
let lastProcessedTime = 0;

// Remove these variables as they're no longer needed
// let lastMessageTime = 0;
// let respondToAllMessages = true;

bot.on('message', async (jsonMsg) => {
    if (!canRespondToMessages) return;

    const message = jsonMsg.toString();
    const timestamp = new Date().toISOString();
    const timedMessage = `[${timestamp}] - ${message}`;

    // Always add the message to chat history
    console.log(`Added message to history: ${timedMessage}`);
    messageHistory.push(timedMessage);
    if (messageHistory.length > 50) {
        messageHistory.shift();
    }

    // Check if the message contains 'ppmoment' or 'ppmoment:' and skip adding to newMessages if it does
    if (message.toLowerCase().includes('<ppmoment>') || message.includes('ppmoment:')) {
        console.log('Skipping message to prevent responding to messages containing "<ppmoment>" or "ppmoment:".');
        return;
    }

    // Check if the incoming message's end matches the end of any of the last sent messages
    if (messageEndsMatchLastSent(message)) {
        console.log('Skipping message to prevent responding to own message.');
        return;
    }

    // Add new message to the batch for AI processing
    newMessages.push(message);
});

// New function to process batched messages
async function processBatchedMessages() {
    if (newMessages.length === 0) return;

    const currentTime = Date.now();
    if (currentTime - lastProcessedTime < 5000) return;

    console.log(`Processing ${newMessages.length} new messages`);

    const batchedMessage = newMessages.join('\n');
    newMessages = []; // Clear the batch

    try {
        const payload = buildPayload(batchedMessage, messageHistory.join('\n'));
        const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload);

        if (response.choices && response.choices[0].message) {
            let messageContent = response.choices[0].message.content.trim();
            
            try {
                const jsonResponse = JSON.parse(messageContent);
                console.log(`AI Thought: ${jsonResponse.thought}`);

                if (jsonResponse.shouldRespond) {
                    if (jsonResponse.newTool) {
                        const addToolResult = addNewTool(jsonResponse.newTool);
                        console.log(addToolResult);
                    }

                    if (jsonResponse.tool) {
                        const toolResult = handleToolUsage(jsonResponse.tool, jsonResponse.args);
                        if (toolResult && toolResult.startsWith("Error:")) {
                            console.error(toolResult);
                        }
                    }

                    if (jsonResponse.message) {
                        setTimeout(() => {
                            bot.chat(jsonResponse.message);
                            console.log(`Bot response: ${jsonResponse.message}`);
                            trackSentMessage(jsonResponse.message);
                        }, 3000);
                    }
                } else {
                    console.log('AI decided not to respond to these messages.');
                }
            } catch (error) {
                console.log('Response is not in JSON format:', error);
            }
        } else {
            console.error('Invalid response structure:', response);
        }
    } catch (error) {
        console.error('Error handling batched messages:', error);
    }

    lastProcessedTime = currentTime;
}

// Set up interval to process batched messages every 5 seconds
setInterval(processBatchedMessages, 5000);

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
    if (tool.startsWith('/')) {
        const command = args ? `${tool} ${args}` : tool;
        bot.chat(command);
        return null;
    }
    return `Error: Unknown tool command ${tool}`;
}

// Remove or comment out the old processMessage function
// async function processMessage(message) { ... }