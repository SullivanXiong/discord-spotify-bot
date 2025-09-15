"use strict";

const { SlashCommandBuilder } = require("discord.js");

function initializeDeviceCommand() {
    return {
        data: new SlashCommandBuilder()
            .setName('device')
            .setDescription('Manage the Spotify Connect device')
            .addSubcommand(sub => sub
                .setName('start')
                .setDescription('Start the Spotify Connect device (librespot)'))
            .addSubcommand(sub => sub
                .setName('stop')
                .setDescription('Stop the Spotify Connect device'))
            .addSubcommand(sub => sub
                .setName('status')
                .setDescription('Show device status')),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });
            const sub = interaction.options.getSubcommand();
            try {
                if (sub === 'start') {
                    if (!this.voice.connection) {
                        await this.voice.joinVoiceChannelByInteraction(interaction);
                    }
                    this.librespot.start();
                    this.voice.playFromFifo(this.librespot.fifoPath);
                    await interaction.editReply(`Device started as "${this.librespot.deviceName}". Select it in Spotify and press play.`);
                } else if (sub === 'stop') {
                    this.voice.stopPlayback();
                    this.librespot.stop();
                    await interaction.editReply('Device stopped.');
                } else if (sub === 'status') {
                    const status = this.librespot.isRunning() ? 'running' : 'stopped';
                    const vc = this.voice.connection ? 'connected' : 'disconnected';
                    await interaction.editReply(`Device is ${status}. Voice is ${vc}. FIFO: ${this.librespot.fifoPath}`);
                }
            } catch (err) {
                await interaction.editReply(`Error: ${err.message}`);
            }
        }
    };
}

module.exports = { initializeDeviceCommand };

