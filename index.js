const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const commandsIndex = require('./commands/index.js');
const { LibrespotController } = require('./lib/librespot.js');
const { VoiceController } = require('./lib/voice.js');
require('dotenv').config();

class DiscordSpotifyBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.spotify = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        });

        this.commands = new Collection();
        this.librespot = new LibrespotController({
            deviceName: process.env.LIBRESPOT_DEVICE_NAME,
            fifoPath: process.env.LIBRESPOT_FIFO_PATH,
            librespotPath: process.env.LIBRESPOT_PATH
        });
        this.voice = new VoiceController({
            onDebugLog: (msg) => console.log(msg)
        });
        this.initializeCommands();
        this.setupEventHandlers();
    }

    initializeCommands() {
        const builders = [
            commandsIndex.initializePlayCommand,
            commandsIndex.initializeJoinCommand,
            commandsIndex.initializeLeaveCommand,
            commandsIndex.initializeDeviceCommand
        ].filter(Boolean);

        for (const builder of builders) {
            const cmd = builder();
            this.commands.set(cmd.data.name, cmd);
        }
    }

    setupEventHandlers() {
	  this.client.once('ready', async () => {
            console.log(`${this.client.user.tag} is online and ready to play music!`);
            
            // Authenticate with Spotify
            try {
                const data = await this.spotify.clientCredentialsGrant();
                this.spotify.setAccessToken(data.body['access_token']);
                console.log('Successfully authenticated with Spotify API');
                
                // Refresh token periodically (every 50 minutes)
                setInterval(async () => {
                    try {
                        const data = await this.spotify.clientCredentialsGrant();
                        this.spotify.setAccessToken(data.body['access_token']);
                        console.log('Spotify token refreshed');
                    } catch (error) {
                        console.error('Error refreshing Spotify token:', error);
                    }
                }, 50 * 60 * 1000);
                
            } catch (error) {
                console.error('Failed to authenticate with Spotify:', error);
            }

            // Register slash commands
            await this.registerSlashCommands();
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute.call(this, interaction, this.spotify);
            } catch (error) {
                console.error('Error executing command:', error);
                const reply = { content: 'There was an error executing this command!', ephemeral: true };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        });
    }

    async registerSlashCommands() {
        const commands = Array.from(this.commands.values()).map(command => command.data.toJSON());
        
        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
            
            console.log('Started refreshing application (/) commands.');
            
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            
            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error registering slash commands:', error);
        }
    }

    isSpotifyUrl(url) {
        return url.includes('spotify.com/track/') || url.includes('spotify:track:');
    }

    async getTrackFromUrl(url, spotify) {
        // Extract track ID from Spotify URL
        let trackId;
        if (url.includes('spotify.com/track/')) {
            trackId = url.split('/track/')[1].split('?')[0];
        } else if (url.includes('spotify:track:')) {
            trackId = url.split('spotify:track:')[1];
        }

        const track = await spotify.getTrack(trackId);
        return track.body;
    }

    async searchSpotify(query, spotify) {
        try {
            const searchResults = await spotify.searchTracks(query, { limit: 5 });
            const tracks = searchResults.body.tracks.items;

            if (tracks.length === 0) {
                return 'No tracks found for your search query.';
            }

            let response = `**Search Results for:** "${query}"\n\n`;
            
            tracks.forEach((track, index) => {
                const artists = track.artists.map(artist => artist.name).join(', ');
                const duration = this.formatDuration(track.duration_ms);
                
                response += `**${index + 1}.** ${track.name}\n`;
                response += `**Artist(s):** ${artists}\n`;
                response += `**Album:** ${track.album.name}\n`;
                response += `**Duration:** ${duration}\n`;
                response += `**Spotify:** ${track.external_urls.spotify}\n`;
                if (track.preview_url) {
                    response += `**Preview:** ${track.preview_url}\n`;
                }
                response += `\n`;
            });

            return response;
        } catch (error) {
            console.error('Spotify search error:', error);
            throw new Error('Failed to search Spotify');
        }
    }

    formatTrackResponse(track) {
        const artists = track.artists.map(artist => artist.name).join(', ');
        const duration = this.formatDuration(track.duration_ms);
        
        let response = `**Track Information**\n\n`;
        response += `**Song:** ${track.name}\n`;
        response += `**Artist(s):** ${artists}\n`;
        response += `**Album:** ${track.album.name}\n`;
        response += `**Release Date:** ${track.album.release_date}\n`;
        response += `**Duration:** ${duration}\n`;
        response += `**Popularity:** ${track.popularity}/100\n`;
        response += `**Spotify:** ${track.external_urls.spotify}\n`;
        
        if (track.preview_url) {
            response += `**Preview:** ${track.preview_url}\n`;
        }

        return response;
    }

    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${seconds.padStart(2, '0')}`;
    }

    async start() {
        // Validate environment variables
        if (!process.env.DISCORD_TOKEN) {
            console.error('DISCORD_TOKEN is not set in environment variables');
            process.exit(1);
        }

        if (!process.env.CLIENT_ID) {
            console.error('CLIENT_ID is not set in environment variables');
            process.exit(1);
        }

        // Spotify search uses client credentials, but librespot does not require them here.

        try {
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('Failed to login to Discord:', error);
            process.exit(1);
        }
    }
}

// Only start the bot if this file is run directly
if (require.main === module) {
    const bot = new DiscordSpotifyBot();
    bot.start();
}

module.exports = DiscordSpotifyBot;
