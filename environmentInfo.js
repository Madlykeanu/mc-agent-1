/**
 * environmentInfo.js
 * Module to retrieve information about the bot's surroundings using ray tracing.
 */

const Vec3 = require('vec3');

function getEnvironmentInfo(bot) {
    if (!bot || !bot.entity) {
        console.log("[getEnvironmentInfo] Bot or bot.entity is undefined");
        return {
            visiblePlayers: [],
            visibleMobs: [],
            visibleBlocks: []
        };
    }

    const viewDistance = 50;
    const visiblePlayers = [];
    const visibleMobs = [];
    const visibleBlocks = [];

    // Helper function to check if an entity is visible
    function isVisible(entity) {
        const { position: start } = bot.entity;
        const end = entity.position.offset(0, entity.height * 0.5, 0);
        const block = bot.world.raycast(start, end, viewDistance);
        return !block || block.position.distanceTo(end) < 1;
    }

    // Check visible players
    Object.values(bot.players).forEach(player => {
        if (player.entity && player.entity !== bot.entity && isVisible(player.entity)) {
            visiblePlayers.push({
                name: player.username,
                distance: player.entity.position.distanceTo(bot.entity.position).toFixed(2)
            });
        }
    });

    // Check visible mobs
    Object.values(bot.entities).forEach(entity => {
        if (entity.type === 'mob' && isVisible(entity)) {
            visibleMobs.push({
                name: entity.name,
                distance: entity.position.distanceTo(bot.entity.position).toFixed(2)
            });
        }
    });

    // Ray casting to find visible blocks in 360 degrees
    const { position } = bot.entity;
    const eyePosition = position.offset(0, bot.entity.height, 0);
    const horizontalSteps = 64; // Increased for higher resolution
    const verticalSteps = 32;   // Increased for higher resolution

    for (let vStep = 0; vStep < verticalSteps; vStep++) {
        const vAngle = (Math.PI * vStep) / verticalSteps - Math.PI / 2;
        for (let hStep = 0; hStep < horizontalSteps; hStep++) {
            const hAngle = (Math.PI * 2 * hStep) / horizontalSteps;
            
            const x = Math.cos(hAngle) * Math.cos(vAngle);
            const y = Math.sin(vAngle);
            const z = Math.sin(hAngle) * Math.cos(vAngle);
            const direction = new Vec3(x, y, z);
            
            const block = bot.world.raycast(eyePosition, direction, viewDistance);
            if (block) {
                const blockKey = `${block.position.x},${block.position.y},${block.position.z}`;
                if (!visibleBlocks.some(b => b.position === blockKey)) {
                    visibleBlocks.push({
                        name: block.name,
                        position: blockKey,
                        isSolid: block.boundingBox === 'block',
                        canBeWalkedOn: block.boundingBox === 'block' || block.boundingBox === 'step',
                        canWalkThrough: block.boundingBox === 'empty'
                    });
                }
            }
        }
    }

    return {
        visiblePlayers,
        visibleMobs,
        visibleBlocks: visibleBlocks.slice(0, 200) // Increased limit to 200 blocks
    };
}

module.exports = { getEnvironmentInfo };
