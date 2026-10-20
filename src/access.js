// Qui a le droit de modifier / arrêter un timer déjà en cours sur le serveur ?
// - personne n'est bloqué s'il n'y a pas de timer actif ;
// - sinon : il faut être dans le même salon vocal que le bot, ou avoir la permission « Gérer le serveur ».
function canControl({ sessionChannelId, userChannelId, isManager }) {
  if (!sessionChannelId) return true;
  if (isManager) return true;
  return Boolean(userChannelId) && userChannelId === sessionChannelId;
}

module.exports = { canControl };
