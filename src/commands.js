const { SlashCommandBuilder, InteractionContextType } = require('discord.js');

const timer = new SlashCommandBuilder()
  .setName('timer')
  .setDescription('Timer vocal : annonce une phrase à voix haute à intervalles réguliers')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s
    .setName('start')
    .setDescription('Lance le timer dans le salon vocal où tu es')
    .addNumberOption((o) => o.setName('intervalle').setDescription('Minutes entre deux annonces (défaut : 5)').setMinValue(0.5).setMaxValue(120))
    .addNumberOption((o) => o.setName('duree').setDescription('Durée totale du timer en minutes (défaut : 60)').setMinValue(1).setMaxValue(720))
    .addStringOption((o) => o.setName('message').setDescription('Phrase annoncée à voix haute').setMaxLength(100))
    .addNumberOption((o) => o.setName('premiere_annonce').setDescription('Minutes avant la 1re annonce (défaut : = intervalle)').setMinValue(0.1).setMaxValue(120)))
  .addSubcommand((s) => s.setName('stop').setDescription('Arrête le timer et quitte le salon vocal'))
  .addSubcommand((s) => s.setName('status').setDescription('Affiche l\'état du timer'))
  .addSubcommand((s) => s
    .setName('test')
    .setDescription('Dit la phrase une fois, tout de suite (pour vérifier le son)')
    .addStringOption((o) => o.setName('message').setDescription('Phrase à tester').setMaxLength(100)));

const commands = [timer.toJSON()];

module.exports = { commands };
