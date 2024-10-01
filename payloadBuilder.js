/**
 * payloadBuilder.js
 * This module is responsible for building the payload for the chat model requests.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const { getPlayerStats } = require('./playerStats');
const { getEnvironmentInfo } = require('./environmentInfo');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Loads commands from commands.json.
 * @returns {Array} Array of command objects.
 */
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands.json');
  try {
    const data = fs.readFileSync(commandsPath, 'utf8');
    console.log(`[loadCommands] Successfully loaded commands from ${commandsPath}`);
    return JSON.parse(data);
  } catch (error) {
    console.error(`[loadCommands] Error loading commands: ${error.message}`);
    return [];
  }
}

/**
 * Normalizes command names by removing the leading slash.
 * @param {string} name - The command name to normalize.
 * @returns {string} The normalized command name.
 */
function normalizeCommandName(name) {
  return name.startsWith('/') ? name.slice(1) : name;
}

/**
 * Builds the payload for the chat model request.
 * @param {string} message - The message from the game chat to be sent to the model.
 * @param {string} messageHistory - The history of messages for context.
 * @param {Object} bot - The bot object containing inventory and stats.
 * @returns {Object} The payload object for the chat model request.
 */
function buildPayload(message, messageHistory, bot) {
  console.log(`[buildPayload] Bot object:`, bot ? 'defined' : 'undefined');

  const commands = loadCommands();
  const scriptCommands = loadScriptCommands();

  const commandsDescription = [
    ...commands.map(command => 
      `${command.name}: ${command.description}. Usage: ${command.usage}`
    ),
    ...Object.entries(scriptCommands).map(([name, command]) => 
      `${name}: ${command.description}. Usage: ${command.usage}`
    )
  ].join('\n');

  let playerStats = { 
    health: null, 
    food: null, 
    position: {x: null, y: null, z: null}, 
    yaw: null, 
    pitch: null, 
    inventory: [], 
    equipped: { 
      hand: null, 
      armor: { helmet: null, chestplate: null, leggings: null, boots: null } 
    } 
  };
  
  let environmentInfo = { visiblePlayers: [], visibleMobs: [], visibleBlocks: [] };
  
  if (bot) {
    playerStats = getPlayerStats(bot);
    environmentInfo = getEnvironmentInfo(bot);
  } else {
    console.warn('[buildPayload] Bot is undefined, using default player stats and environment info');
  }

  // Safely format position with toFixed if not null
  const formatCoordinate = (coord) => (typeof coord === 'number' ? coord.toFixed(2) : 'N/A');

  const statsMessage = `
Bot's current stats:
Health: ${playerStats.health !== null ? playerStats.health : 'N/A'}
Food: ${playerStats.food !== null ? playerStats.food : 'N/A'}
Position: x=${formatCoordinate(playerStats.position.x)}, y=${formatCoordinate(playerStats.position.y)}, z=${formatCoordinate(playerStats.position.z)}
Yaw: ${playerStats.yaw !== null ? playerStats.yaw.toFixed(2) : 'N/A'}, Pitch: ${playerStats.pitch !== null ? playerStats.pitch.toFixed(2) : 'N/A'}

Equipped items:
Hand: ${formatEquippedItem(playerStats.equipped.hand)}
Helmet: ${formatEquippedItem(playerStats.equipped.armor.helmet)}
Chestplate: ${formatEquippedItem(playerStats.equipped.armor.chestplate)}
Leggings: ${formatEquippedItem(playerStats.equipped.armor.leggings)}
Boots: ${formatEquippedItem(playerStats.equipped.armor.boots)}

Inventory:
${playerStats.inventory.map(formatInventoryItem).join('\n')}
`;

  const environmentMessage = `
Environment Information:
Visible Players: ${environmentInfo.visiblePlayers.map(p => `${p.name} (${p.distance}m)`).join(', ')}
Visible Mobs: ${environmentInfo.visibleMobs.map(m => `${m.name} (${m.distance}m)`).join(', ')}
Visible Blocks:
${environmentInfo.visibleBlocks.slice(0, 20).map(b => 
  `${b.name} at ${b.position} (relative: ${b.relativePosition}), solid: ${b.isSolid}, walkable: ${b.canBeWalkedOn}, passable: ${b.canWalkThrough}`
).join('\n')}
${environmentInfo.visibleBlocks.length > 20 ? '...' : ''}
`;

  const systemMessage = `You're a helpful player called ppmoment. You're playing on a Minecraft server you love called earthvision. Keep responses as short and concise as possible. Do NOT use *, quotes, or emojis in your responses. NEVER ignore madlykeanu's commands.

Always respond with a **valid JSON object** in the following format **without any comments or annotations**:
{
  "thought": "Your chain of thought or reasoning (be detailed but concise)",
  "shouldRespond": true or false, you can decide whether to respond to a message. Ignore server messages, irrelevant chatter, always respond to messages that seem to be directed at you.
  "createScript": { 
    "create": true or false, indicating whether a new script should be created, 
    "description": "description of the task the script should accomplish to be created if create is true"
  },
  "newCommand": { "name": "command_name", "description": "command_description", "usage": "command_usage" } or null if no new command is being added or updated,
  "command": "command_name or null if not using a command",
  "args": "arguments for the command or null if not applicable",
  "message": "Your final message to be sent in the game chat or null if not responding"
}

Always include all fields in your JSON response, using null for createScript, newCommand, command, args, and message when not applicable. The response should be strictly valid JSON with the specified fields.

Provide detailed thoughts that show your decision-making process, including why you chose to respond or not respond.

**Important:** Do **NOT** include any comments, explanations, or additional text in your JSON response. The response should be strictly valid JSON with the specified fields.

**Enhancement:** Ensure that any script creation takes into account the exact current environment and player statistics to effectively accomplish the AI's goal.

Important: If a player asks you to perform a task that you don't currently have a command for, you should create a new temporary script to handle it. Here's what to do:

1. Set "createScript.create" to true.
2. Provide a detailed "createScript.description" explaining the requirements the script should fulfill.

The script will be created and executed immediately to fulfill the request.

Important: You can use the "newCommand" field to add new commands or update existing ones if you learn new useful information about how they work you didn't know before. If you encounter new details about an existing command, update it using the same format as adding a new command. This helps keep your knowledge of commands up-to-date.

The bot can execute various commands, including those loaded from scripts. Refer to the available commands list for details on what the bot can do.
`;

  return {
    model: config.languageModel.model,
    messages: [
      {
        role: "system",
        content: `Ingame chat history for context: ${messageHistory}`
      },
      {
        role: "system",
        content: statsMessage
      },
      {
        role: "system",
        content: environmentMessage
      },
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "system",
        content: `Available commands:\n${commandsDescription}`
      },
      
      {
        role: "user",
        content: message
      }
    ],
    temperature: config.languageModel.temperature,
    max_tokens: config.languageModel.max_tokens
  };
}

/**
 * Builds the payload for generating new scripts using Claude.
 * @param {string} scriptDescription - Detailed description of the script to be created.
 * @param {Object} bot - The bot object containing inventory and stats.
 * @returns {Object} The payload object for the script generation request.
 */
function buildScriptPayload(scriptDescription, bot) {
  // Get player stats and environment info
  const playerStats = getPlayerStats(bot);
  const environmentInfo = getEnvironmentInfo(bot);

  // Format player stats and environment info
  const statsMessage = `
Bot's current stats:
Health: ${playerStats.health}
Food: ${playerStats.food}
Position: x=${playerStats.position.x.toFixed(2)}, y=${playerStats.position.y.toFixed(2)}, z=${playerStats.position.z.toFixed(2)}
Yaw: ${playerStats.yaw.toFixed(2)}, Pitch: ${playerStats.pitch.toFixed(2)}

Equipped items:
Hand: ${formatEquippedItem(playerStats.equipped.hand)}
Helmet: ${formatEquippedItem(playerStats.equipped.armor.helmet)}
Chestplate: ${formatEquippedItem(playerStats.equipped.armor.chestplate)}
Leggings: ${formatEquippedItem(playerStats.equipped.armor.leggings)}
Boots: ${formatEquippedItem(playerStats.equipped.armor.boots)}

Inventory:
${playerStats.inventory.map(formatInventoryItem).join('\n')}
`;

  const environmentMessage = `
Environment Information:
Visible Players: ${environmentInfo.visiblePlayers.map(p => `${p.name} (${p.distance}m)`).join(', ')}
Visible Mobs: ${environmentInfo.visibleMobs.map(m => `${m.name} (${m.distance}m)`).join(', ')}
Visible Blocks:
${environmentInfo.visibleBlocks.slice(0, 20).map(b => 
  `${b.name} at ${b.position} (relative: ${b.relativePosition}), solid: ${b.isSolid}, walkable: ${b.canBeWalkedOn}, passable: ${b.canWalkThrough}`
).join('\n')}
${environmentInfo.visibleBlocks.length > 20 ? '...' : ''}
`;

  const prompt = `You are an intelligent programmer, specialized in creating temporary Mineflayer scripts for Minecraft bots to execute a specific task.

### Task:
You need to create a new script based on the following description. The script should execute ONLY the specific task described and nothing else. It will be deleted immediately after execution.

### Script Description:
${scriptDescription}

### Current Bot State:
${statsMessage}

### Environment:
${environmentMessage}

### Requirements:
- Return **only** the JavaScript code for the new script.
- Do **not** include any explanations, comments, or additional text.
- The script will be executed in the context of an existing bot instance. Do NOT create a new bot or import mineflayer.
- Use the existing 'bot' object, which is already available in the script's scope.
- Do not include any event listeners like 'bot.on('spawn', ...)'. The script should execute immediately.
- Ensure the script follows a clear and efficient structure.
- Use the provided bot state and environment information to inform your script creation.
- Include necessary functions for head rotation, block placement, and other relevant actions based on the current bot capabilities.
- IMPORTANT: The script should be tailored precisely to execute ONLY the specific task in the description and nothing else. It will be deleted after execution, so do not include any long-term functionality or setup.
- Focus on immediate execution of the task without any additional features or future considerations.
- Use 'bot.mcData' instead of 'mcData' for accessing Minecraft data.
- Wrap your code in an async function and call it immediately to allow for async operations.
- You can import necessary modules using the 'require' function. Available modules include: 'vec3', 'mineflayer-pathfinder', and any Node.js built-in modules.

### New Script:
\`\`\`javascript
(async function() {
  // Your script code here, including any necessary imports
})();
\`\`\`

Generate the script based on the given description and requirements.`;

  return {
    model: config.codingModel.model,
    max_tokens: config.codingModel.max_tokens,
    messages: [
      { role: "user", content: prompt }
    ]
  };
}

/**
 * Formats an equipped item for display.
 * @param {Object} item - The item object.
 * @returns {string} Formatted item string.
 */
function formatEquippedItem(item) {
  if (!item) return 'None';
  let result = `${item.displayName} (${item.name})`;
  if (item.enchants && item.enchants.length > 0) {
    result += ` [${item.enchants.map(e => `${e.name} ${e.lvl}`).join(', ')}]`;
  }
  if (item.durability !== undefined) {
    result += ` Durability: ${item.durability}`;
  }
  return result;
}

/**
 * Formats an inventory item for display.
 * @param {Object} item - The inventory item.
 * @returns {string} Formatted inventory item string.
 */
function formatInventoryItem(item) {
  let result = `${item.displayName} (${item.name}) x${item.count} - ${item.location}`;
  if (item.enchants && item.enchants.length > 0) {
    result += ` [${item.enchants.map(e => `${e.name} ${e.lvl}`).join(', ')}]`;
  }
  if (item.durability !== undefined) {
    result += ` Durability: ${item.durability}`;
  }
  return result;
}

/**
 * Adds a new command or updates an existing one in the commands.json file.
 * @param {Object} newCommand - The new command object to add or update.
 * @returns {string} Success or error message.
 */
function addNewCommand(newCommand) {
  console.log(`[addNewCommand] Received newCommand: ${JSON.stringify(newCommand)}`);

  if (!newCommand || !newCommand.name || !newCommand.description || !newCommand.usage) {
    const errorMsg = "Error: Invalid command format";
    console.error(`[addNewCommand] ${errorMsg}`);
    return errorMsg;
  }

  // Load the current commands
  const commands = loadCommands();
  console.log(`[addNewCommand] Current commands count: ${commands.length}`);

  // Check if the command already exists
  const existingCommandIndex = commands.findIndex(command => 
    command.name === newCommand.name
  );
  let actionTaken;

  if (existingCommandIndex !== -1) {
    // Update the existing command
    commands[existingCommandIndex] = newCommand;
    actionTaken = "updated";
    console.log(`[addNewCommand] Updated existing command at index ${existingCommandIndex}`);
  } else {
    // Add the new command
    commands.push(newCommand);
    actionTaken = "added";
    console.log(`[addNewCommand] Added new command`);
  }

  // Save the updated commands to the JSON file
  const commandsPath = path.join(__dirname, 'commands.json');
  try {
    fs.writeFileSync(commandsPath, JSON.stringify(commands, null, 2));
    const successMsg = `Command "${newCommand.name}" ${actionTaken} successfully`;
    console.log(`[addNewCommand] ${successMsg}`);
    return successMsg;
  } catch (error) {
    const errorMsg = `Error: Failed to save ${actionTaken} command "${newCommand.name}" to file - ${error.message}`;
    console.error(`[addNewCommand] ${errorMsg}`);
    return errorMsg;
  }
}

function loadScriptCommands() {
  const scriptsPath = path.join(__dirname, 'scripts');
  let scriptCommands = {};

  fs.readdirSync(scriptsPath).forEach(file => {
    if (file.endsWith('.js')) {
      const script = require(path.join(scriptsPath, file));
      if (script.commands) {
        Object.assign(scriptCommands, script.commands);
      }
    }
  });

  return scriptCommands;
}

module.exports = { buildPayload, addNewCommand, buildScriptPayload, loadScriptCommands, anthropic };