module.exports = {
    init(bot) {
        // Any initialization code can go here
    },
    commands: {
        dropitem: {
            description: "Selects and drops items from the bot's inventory, even across multiple stacks. Examples: 'dropitem diamond' to drop 1 diamond, 'dropitem dirt 64' to drop 64 dirt, 'dropitem gold_block 200' to drop 200 gold blocks.",
            usage: "dropitem <item name> [quantity]",
            execute: function(bot, args) {
                return new Promise(async (resolve, reject) => {
                    const itemName = args.split(' ')[0];
                    const quantity = parseInt(args.split(' ')[1]) || 1;

                    if (!itemName) {
                        resolve("Error: No item name provided. Usage: dropitem <item name> [quantity]. Examples: 'dropitem diamond' or 'dropitem dirt 64'");
                        return;
                    }

                    // Find all matching items in the bot's inventory
                    const matchingItems = bot.inventory.items().filter(item => item.name.toLowerCase().includes(itemName.toLowerCase()));

                    if (matchingItems.length === 0) {
                        resolve(`Error: Could not find '${itemName}' in the inventory.`);
                        return;
                    }

                    let totalDropped = 0;
                    let remainingToDrop = quantity;

                    for (const item of matchingItems) {
                        if (remainingToDrop <= 0) break;

                        const dropCount = Math.min(remainingToDrop, item.count);
                        try {
                            await bot.toss(item.type, null, dropCount);
                            totalDropped += dropCount;
                            remainingToDrop -= dropCount;
                        } catch (err) {
                            resolve(`Error dropping item: ${err.message}. Dropped ${totalDropped} ${itemName} before error occurred.`);
                            return;
                        }
                    }

                    if (totalDropped > 0) {
                        resolve(`Successfully dropped ${totalDropped} ${itemName}.`);
                    } else {
                        resolve(`Could not drop any ${itemName}. Requested: ${quantity}, Available: ${matchingItems.reduce((sum, item) => sum + item.count, 0)}`);
                    }
                });
            }
        },
        
    }
};