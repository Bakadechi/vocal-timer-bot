require('dotenv').config();
const { Client, GatewayIntentBits, MessageFlags, PermissionFlagsBits, Events } = require('discord.js');
const voice = require('@discordjs/voice');
const { getAudioFile } = require('./tts');
const { VoiceTimerSession } = require('./schedule');
const { canControl } = require('./access');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant : copie .env.example en .env et remplis-le.');
  process.exit(1);
}
const DEFAULT_MESSAGE = process.env.DEFAULT_MESSAGE || 'C\'est l\'heure !';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

/** Erreur à afficher telle quelle à l'utilisateur (pas de stack trace). */
class UserError extends Error {}

/** guildId -> { guildId, channelId, channelName, connection, player, session } */
const states = new Map();

const fmt = (n) => String(Number(n.toFixed(2)));
const unix = (ms) => Math.floor(ms / 1000);
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('fr-FR')}]`, ...a);

function cleanup(guildId) {
  const st = states.get(guildId);
  if (!st) return;
  states.delete(guildId);
  const session = st.session;
  st.session = null;
  session?.stop('arrêt');
  try { st.player.stop(true); } catch { /* rien */ }
  try { st.connection.destroy(); } catch { /* rien */ }
}

function controlContext(interaction, state) {
  return {
    sessionChannelId: state?.session ? state.channelId : null,
    userChannelId: interaction.guild.voiceStates.cache.get(interaction.user.id)?.channelId ?? null,
    isManager: Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
  };
}

async function playFile(state, file) {
  const resource = voice.createAudioResource(file);
  state.player.play(resource);
  await voice.entersState(state.player, voice.AudioPlayerStatus.Idle, 30_000);
}

async function joinUserChannel(interaction) {
  const guild = interaction.guild;
  const channel = guild.voiceStates.cache.get(interaction.user.id)?.channel;
  if (!channel) throw new UserError('Rejoins d\'abord un salon vocal, puis relance la commande.');

  const me = guild.members.me ?? await guild.members.fetchMe();
  const perms = channel.permissionsFor(me);
  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];
  if (!perms || !perms.has(needed)) {
    throw new UserError(`Il me manque une permission (Voir le salon, Se connecter ou Parler) dans ${channel}.`);
  }

  const existing = states.get(guild.id);
  if (existing && existing.channelId === channel.id) return existing;
  if (existing) cleanup(guild.id);

  const connection = voice.joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });
  const player = voice.createAudioPlayer({ behaviors: { noSubscriber: voice.NoSubscriberBehavior.Play } });
  const state = { guildId: guild.id, channelId: channel.id, channelName: channel.name, connection, player, session: null };
  states.set(guild.id, state);

  try {
    await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, 20_000);
  } catch {
    cleanup(guild.id);
    throw new UserError('Impossible de me connecter au salon vocal (délai dépassé). Réessaie dans un instant.');
  }
  connection.subscribe(player);

  connection.on(voice.VoiceConnectionStatus.Disconnected, async () => {
    if (states.get(guild.id) !== state) return;
    try {
      await Promise.race([
        voice.entersState(connection, voice.VoiceConnectionStatus.Signalling, 5_000),
        voice.entersState(connection, voice.VoiceConnectionStatus.Connecting, 5_000)
      ]);
    } catch {
      log('Déconnecté du salon vocal : timer arrêté.');
      cleanup(guild.id);
    }
  });
  player.on('error', (err) => log('Erreur audio :', err.message));
  return state;
}

async function handleStart(interaction) {
  const intervalMin = interaction.options.getNumber('intervalle') ?? 5;
  const durationMin = interaction.options.getNumber('duree') ?? 60;
  const firstMin = interaction.options.getNumber('premiere_annonce') ?? intervalMin;
  const message = interaction.options.getString('message') ?? DEFAULT_MESSAGE;

  if (firstMin > durationMin) {
    throw new UserError('La première annonce tombe après la fin du timer : augmente la durée ou réduis le délai.');
  }

  const current = states.get(interaction.guildId);
  if (!canControl(controlContext(interaction, current))) {
    throw new UserError(`Un timer tourne déjà dans **${current.channelName}**. Rejoins ce salon pour le modifier, ou demande à un modérateur de l'arrêter avec /timer stop.`);
  }

  const file = await getAudioFile(message); // généré (ou lu du cache) AVANT de lancer le timer
  const state = await joinUserChannel(interaction);

  const old = state.session;
  state.session = null;
  old?.stop('remplacé');

  const session = new VoiceTimerSession({
    intervalSec: intervalMin * 60,
    durationSec: durationMin * 60,
    firstInSec: firstMin * 60,
    message,
    speak: async () => {
      log(`🔊 « ${message} »`);
      await playFile(state, file);
    },
    onError: (err) => log('Erreur pendant une annonce :', err.message),
    onEnd: (reason) => {
      log(`Timer terminé (${reason}).`);
      if (states.get(state.guildId) === state && state.session === session) cleanup(state.guildId);
    }
  });
  state.session = session;
  session.start();
  log(`Timer lancé dans #${state.channelName} : « ${message} » toutes les ${fmt(intervalMin)} min pendant ${fmt(durationMin)} min.`);

  await interaction.editReply(
    `✅ Timer lancé dans **${state.channelName}** : « ${message} » toutes les **${fmt(intervalMin)} min** pendant **${fmt(durationMin)} min**.\n` +
    `Première annonce <t:${unix(session.nextAt)}:R>, fin du timer <t:${unix(session.endAt)}:R>.`
  );
}

async function handleStop(interaction) {
  const state = states.get(interaction.guildId);
  if (!state) throw new UserError('Aucun timer actif sur ce serveur.');
  if (!canControl(controlContext(interaction, state))) {
    throw new UserError('Pour arrêter le timer, il faut être dans le même salon vocal que moi (ou avoir la permission « Gérer le serveur »).');
  }
  cleanup(interaction.guildId);
  await interaction.editReply('⏹️ Timer arrêté, j\'ai quitté le salon vocal.');
}

async function handleStatus(interaction) {
  const state = states.get(interaction.guildId);
  const session = state?.session;
  if (!session) throw new UserError('Aucun timer actif sur ce serveur.');
  const next = session.nextAt ? `prochaine annonce <t:${unix(session.nextAt)}:R>` : 'plus d\'annonce prévue';
  await interaction.editReply(
    `⏱️ Timer actif dans **${state.channelName}** : « ${session.message} » toutes les ${fmt(session.intervalSec / 60)} min.\n` +
    `${next} — ${session.announced} annonce(s) faite(s) — fin <t:${unix(session.endAt)}:R>.`
  );
}

async function handleTest(interaction) {
  const message = interaction.options.getString('message') ?? DEFAULT_MESSAGE;
  const existing = states.get(interaction.guildId);
  if (!canControl(controlContext(interaction, existing))) {
    throw new UserError('Un timer tourne déjà dans un autre salon vocal. Arrête-le avec /timer stop avant de tester ici.');
  }
  const file = await getAudioFile(message);
  const state = await joinUserChannel(interaction);
  await interaction.editReply('🔊 Test en cours…');
  await playFile(state, file);
  if (!state.session) cleanup(interaction.guildId); // pas de timer en cours : on repart
  await interaction.editReply('✅ Test terminé. Si tu as entendu la phrase, tout fonctionne.');
}

client.once(Events.ClientReady, (c) => {
  log(`✅ Connecté en tant que ${c.user.tag}. Utilise /timer start dans un salon vocal.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'timer') return;
  if (!interaction.inGuild() || !interaction.guild) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') await handleStart(interaction);
    else if (sub === 'stop') await handleStop(interaction);
    else if (sub === 'status') await handleStatus(interaction);
    else if (sub === 'test') await handleTest(interaction);
  } catch (err) {
    if (!(err instanceof UserError)) console.error(err);
    const text = err instanceof UserError ? `⚠️ ${err.message}` : `❌ Erreur : ${err.message}`;
    await interaction.editReply(text).catch(() => {});
  }
});

function shutdown() {
  log('Arrêt du bot…');
  for (const guildId of [...states.keys()]) cleanup(guildId);
  client.destroy();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(process.env.DISCORD_TOKEN);
