"use strict";

const { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, AudioPlayerStatus, StreamType, entersState, VoiceConnectionStatus } = require("@discordjs/voice");
const { Readable } = require("stream");
const { spawn } = require("child_process");
const fs = require("fs");
const which = require("which");
const path = require("path");
const prism = require("prism-media");

class VoiceController {
    constructor(options = {}) {
        this.connection = null;
        this.audioPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });
        this.ffmpegPath = options.ffmpegPath || process.env.FFMPEG_PATH || null;
        this.currentFfmpeg = null;
        this.onDebugLog = options.onDebugLog || (() => {});

        // Resilience fields for handling abrupt seeks / FIFO writer restarts
        this.keepFfmpegAlive = false; // used for both pipelines
        this.ffmpegRespawnTimer = null;
        this.currentFifoPath = null;
        this.isSpawningFfmpeg = false;
        // Native pipeline transforms
        this.nativePipeline = {
            fifoStream: null,
            resampler: null,
            opusEncoder: null
        };

        // Bind once to avoid accumulating listeners across play calls
        this.audioPlayer.on("error", (error) => {
            this.onDebugLog(`Audio player error: ${error.message}`);
        });
        this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
            // If ffmpeg stops, we end up idle; respawn logic is driven by ffmpeg 'exit'
        });
    }

    resolveFfmpegPath() {
        if (this.ffmpegPath && fs.existsSync(this.ffmpegPath)) return this.ffmpegPath;
        try {
            // Prefer static binary if available
            const staticPath = require("ffmpeg-static");
            if (staticPath && fs.existsSync(staticPath)) return staticPath;
        } catch (_) {}
        try {
            return which.sync("ffmpeg");
        } catch (err) {
            return null;
        }
    }

    async joinVoiceChannelByInteraction(interaction) {
        const channel = interaction.member?.voice?.channel;
        if (!channel) {
            throw new Error("You must be in a voice channel to use this command.");
        }
        return this.join(channel.guild.id, channel.id, channel.guild.voiceAdapterCreator);
    }

    async join(guildId, channelId, adapterCreator) {
        this.connection = joinVoiceChannel({
            channelId,
            guildId,
            adapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        this.connection.on("stateChange", (oldState, newState) => {
            this.onDebugLog(`Voice connection state ${oldState.status} -> ${newState.status}`);
        });

        this.connection.subscribe(this.audioPlayer);
        try {
            await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
        } catch (err) {
            this.connection.destroy();
            this.connection = null;
            throw err;
        }
        return this.connection;
    }

    leave() {
        if (this.connection) {
            try { this.connection.destroy(); } catch (_) {}
            this.connection = null;
        }
        this.stopPlayback();
    }

    playFromFifo(fifoPath) {
        if (!this.connection) {
            throw new Error("Not connected to a voice channel.");
        }

        this.keepFfmpegAlive = true;
        this.currentFifoPath = fifoPath;

        const useNative = (process.env.VOICE_PIPELINE || "native").toLowerCase() === "native";
        if (useNative) {
            return this.spawnNativeOpusPipeline(fifoPath);
        } else {
            const ffmpegBinary = this.resolveFfmpegPath();
            if (!ffmpegBinary) {
                throw new Error("ffmpeg not found. Install ffmpeg or add ffmpeg-static dependency.");
            }
            return this.spawnFfmpegForFifo(ffmpegBinary, fifoPath);
        }
    }

    spawnNativeOpusPipeline(fifoPath) {
        // Clean up any existing chain
        this.teardownNativePipeline();

        // Create a fast-draining reader to avoid blocking librespot
        const fifoStream = fs.createReadStream(fifoPath, { highWaterMark: 4096 });

        // Resample 44.1k -> 48k using ffmpeg transform (low-latency)
        const resampler = new prism.FFmpeg({
            args: [
                "-hide_banner", "-loglevel", process.env.FFMPEG_LOGLEVEL || "warning",
                "-fflags", "nobuffer",
                "-flags", "low_delay",
                "-f", "s16le",
                "-ar", process.env.LIBRESPOT_SAMPLE_RATE || "44100",
                "-ac", "2",
                "-i", "pipe:0",
                "-ar", "48000",
                "-ac", "2",
                "-f", "s16le",
                "pipe:1"
            ]
        });

        const allowedDurations = new Set([2.5, 5, 10, 20, 40, 60]);
        const requestedMs = Number(process.env.VOICE_OPUS_FRAME_DURATION || 20);
        const durationMs = allowedDurations.has(requestedMs) ? requestedMs : 20;
        const frameSize = Math.round((48000 * durationMs) / 1000); // 960 for 20ms, 480 for 10ms

        const parseBitrate = (val) => {
            const v = (val || "160k").toString().trim().toLowerCase();
            if (v.endsWith("k")) return parseInt(v, 10) * 1000;
            return parseInt(v, 10) || 160000;
        };
        const opusEncoder = new prism.opus.Encoder({
            rate: 48000,
            channels: 2,
            frameSize,
            bitrate: parseBitrate(process.env.DISCORD_OPUS_BITRATE)
        });

        // Wire errors for observability
        const onError = (prefix) => (err) => this.onDebugLog(`${prefix} error: ${err.message}`);
        fifoStream.on("error", onError("fifo"));
        resampler.on("error", onError("resampler"));
        opusEncoder.on("error", onError("opus"));

        // Build pipeline
        fifoStream.pipe(resampler).pipe(opusEncoder);

        // Save refs for teardown
        this.nativePipeline = { fifoStream, resampler, opusEncoder };

        // Restart on end/close if keepalive
        const scheduleRespawn = () => {
            if (!this.keepFfmpegAlive || !this.connection) return;
            if (this.ffmpegRespawnTimer) clearTimeout(this.ffmpegRespawnTimer);
            this.ffmpegRespawnTimer = setTimeout(() => {
                this.ffmpegRespawnTimer = null;
                try {
                    if (this.currentFifoPath) this.spawnNativeOpusPipeline(this.currentFifoPath);
                } catch (_) {}
            }, 200);
        };
        fifoStream.on("end", scheduleRespawn);
        fifoStream.on("close", scheduleRespawn);

        const resource = createAudioResource(opusEncoder, {
            inputType: StreamType.Opus,
            inlineVolume: false
        });

        this.audioPlayer.play(resource);
        return resource;
    }

    teardownNativePipeline() {
        const { fifoStream, resampler, opusEncoder } = this.nativePipeline;
        if (fifoStream) { try { fifoStream.destroy(); } catch (_) {} }
        if (resampler) { try { resampler.destroy(); } catch (_) {} }
        if (opusEncoder) { try { opusEncoder.destroy(); } catch (_) {} }
        this.nativePipeline = { fifoStream: null, resampler: null, opusEncoder: null };
    }

    spawnFfmpegForFifo(ffmpegBinary, fifoPath) {
        if (this.isSpawningFfmpeg) return null;
        this.isSpawningFfmpeg = true;

        if (this.currentFfmpeg) {
            try { this.currentFfmpeg.kill("SIGTERM"); } catch (_) {}
            this.currentFfmpeg = null;
        }

        // Read raw PCM S16LE 44.1k stereo from the fifo (librespot default),
        // resample to 48k for Discord, and encode to Ogg/Opus
        const ffmpegArgs = [
            "-hide_banner", "-loglevel", process.env.FFMPEG_LOGLEVEL || "warning",
            // Low-latency tuning
            "-fflags", "nobuffer",
            "-flags", "low_delay",
            // Input (raw S16LE from FIFO)
            "-f", "s16le",
            "-ar", process.env.LIBRESPOT_SAMPLE_RATE || "44100",
            "-ac", "2",
            "-i", fifoPath,
            // Output settings
            "-ar", "48000",
            "-ac", "2",
            "-vn",
            "-acodec", "libopus",
            // Opus encoder low-latency parameters
            "-application", process.env.FFMPEG_OPUS_APPLICATION || "voip",
            "-frame_duration", process.env.FFMPEG_OPUS_FRAME_DURATION || "20",
            "-b:a", process.env.DISCORD_OPUS_BITRATE || "160k",
            // Force immediate packet flush
            "-flush_packets", "1",
            "-max_delay", "0",
            "-f", "ogg",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBinary, ffmpegArgs, { stdio: ["ignore", "pipe", "pipe"] });
        this.currentFfmpeg = ffmpeg;
        this.isSpawningFfmpeg = false;

        ffmpeg.stderr.on("data", (d) => this.onDebugLog(`[ffmpeg] ${d}`));
        ffmpeg.on("exit", (code, signal) => {
            this.onDebugLog(`ffmpeg exited with code ${code}, signal ${signal}`);
            if (this.currentFfmpeg === ffmpeg) {
                this.currentFfmpeg = null;
            }
            if (this.keepFfmpegAlive && this.connection) {
                if (this.ffmpegRespawnTimer) {
                    clearTimeout(this.ffmpegRespawnTimer);
                }
                // Small delay to let FIFO writer reconnect
                this.ffmpegRespawnTimer = setTimeout(() => {
                    this.ffmpegRespawnTimer = null;
                    try {
                        const binary = this.resolveFfmpegPath();
                        if (binary && this.currentFifoPath) {
                            this.spawnFfmpegForFifo(binary, this.currentFifoPath);
                        }
                    } catch (_) {}
                }, 300);
            }
        });

        const resource = createAudioResource(ffmpeg.stdout, {
            inputType: StreamType.OggOpus,
            inlineVolume: false
        });

        this.audioPlayer.play(resource);
        return resource;
    }

    stopPlayback() {
        if (this.audioPlayer) {
            try { this.audioPlayer.stop(true); } catch (_) {}
        }
        this.keepFfmpegAlive = false;
        if (this.ffmpegRespawnTimer) {
            clearTimeout(this.ffmpegRespawnTimer);
            this.ffmpegRespawnTimer = null;
        }
        this.teardownNativePipeline();
        if (this.currentFfmpeg) {
            try { this.currentFfmpeg.kill("SIGTERM"); } catch (_) {}
            this.currentFfmpeg = null;
        }
    }
}

module.exports = { VoiceController };

