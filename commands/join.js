"use strict";

const { SlashCommandBuilder } = require("discord.js");

function initializeJoinCommand() {
    return {
        data: new SlashCommandBuilder()
            .setName('join')
            .setDescription('Join your current voice channel'),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });
            try {
                await this.voice.joinVoiceChannelByInteraction(interaction);
                await interaction.editReply('Joined your voice channel.');
            } catch (err) {
                await interaction.editReply(`Failed to join: ${err.message}`);
            }
        }
    };
}

module.exports = { initializeJoinCommand };

