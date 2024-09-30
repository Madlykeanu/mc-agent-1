const { Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow } = goals;

module.exports = {
    init(bot) {
        // Any initialization code can go here
    },
    commands: {
        followplayer: {
            description: "Makes the bot follow the specified player",
            usage: "followplayer <playerName>",
            execute: function(bot, args) {  // Add 'bot' as the first parameter
                const playerName = args;
                if (!playerName) {
                    return "Error: No player name provided for followplayer.";
                }

                const targetPlayer = bot.players[playerName]?.entity;

                if (!targetPlayer) {
                    return `Error: Player "${playerName}" not found.`;
                }

                const mcData = require('minecraft-data')(bot.version);
                const movements = new Movements(bot, mcData);
                bot.pathfinder.setMovements(movements);

                const goal = new GoalFollow(targetPlayer, 1); // 1 block distance

                bot.pathfinder.setGoal(goal, true);
                bot.following = goal;

                return `Bot is now following ${playerName}.`;
            }
        },
        stopfollowing: {
            description: "Stops the bot from following any player",
            usage: "stopfollowing",
            execute: function(bot) {  // Add 'bot' as the parameter
                if (bot.following) {
                    bot.pathfinder.setGoal(null);
                    bot.following = null;
                    return "Bot has stopped following the player.";
                } else {
                    return "Bot is not following anyone.";
                }
            }
        }
    }
};