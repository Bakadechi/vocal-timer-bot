// À lancer une fois (npm run register) pour déclarer la commande /timer à Discord.
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN et CLIENT_ID sont obligatoires dans .env');
  process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);
const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);

rest.put(route, { body: commands })
  .then((data) => console.log(`✅ ${data.length} commande(s) enregistrée(s) ${GUILD_ID ? `sur le serveur ${GUILD_ID} (instantané)` : 'globalement (jusqu\'à 1 h pour apparaître)'}.`))
  .catch((err) => { console.error('❌ Échec :', err.message || err); process.exit(1); });
