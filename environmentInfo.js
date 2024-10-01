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

    const viewDistance = 50; // Increased from 20 to 50
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

    // Ray casting to find visible blocks
    const { position, yaw, pitch } = bot.entity;
    const eyePosition = position.offset(0, bot.entity.height, 0);
    const horizontalFov = Math.PI * 1.5; // Increased to 270 degrees
    const verticalFov = Math.PI * 0.75; // Increased to 135 degrees

    for (let vAngle = -verticalFov / 2; vAngle <= verticalFov / 2; vAngle += Math.PI / 32) {
        for (let hAngle = -horizontalFov / 2; hAngle <= horizontalFov / 2; hAngle += Math.PI / 32) {
            const x = Math.cos(yaw + hAngle) * Math.cos(pitch + vAngle);
            const y = Math.sin(pitch + vAngle);
            const z = Math.sin(yaw + hAngle) * Math.cos(pitch + vAngle);
            const direction = new Vec3(x, y, z);
            
            const block = bot.world.raycast(eyePosition, direction, viewDistance);
            if (block) {
                const blockKey = `${block.position.x},${block.position.y},${block.position.z}`;
                if (!visibleBlocks.some(b => b.position === blockKey)) {
                    visibleBlocks.push({
                        name: block.name,
                        position: blockKey,
                        relativePosition: `${block.position.x - Math.floor(position.x)},${block.position.y - Math.floor(position.y)},${block.position.z - Math.floor(position.z)}`,
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
        visibleBlocks: visibleBlocks.slice(0, 100) // Limit to 100 blocks to prevent overwhelming the AI
    };
}

module.exports = { getEnvironmentInfo };
