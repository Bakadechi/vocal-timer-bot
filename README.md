# Vocal Timer Bot

Bot Discord qui rejoint ton salon vocal et dit une phrase à voix haute
**toutes les X minutes, pendant X minutes**, puis repart. Pratique pour des rappels réguliers pendant
une session de jeu, une séance de sport, un cours, un pomodoro, etc.

- Voix de synthèse gratuite (voix neurales Microsoft Edge) **ou** ton propre fichier son
- Annonces calées sur l'heure de départ (pas de dérive)
- Un timer indépendant **par serveur** : plusieurs serveurs peuvent l'utiliser en même temps
- Aucune donnée stockée, aucune base de données

## Installation

1. Installe **Node.js 22.12 ou plus récent** : https://nodejs.org (vérifie avec `node -v`).
2. Récupère le projet : `git clone https://github.com/Bakadechi/vocal-timer-bot.git` puis `cd vocal-timer-bot`
3. Installe les dépendances : `npm install`
4. Copie `.env.example` en `.env` (tu le rempliras à l'étape suivante).

## Créer ton bot Discord

Chaque personne qui héberge le bot crée **sa propre application** (le token ne se partage jamais) :
https://discord.com/developers/applications → *New Application*.

- **General Information** → copie l'**Application ID** dans `CLIENT_ID`.
- Onglet **Bot** → **Reset Token** → copie-le dans `DISCORD_TOKEN` (il ne s'affiche qu'une fois).
  Laisse *Requires OAuth2 Code Grant* désactivé. Aucun « Privileged Intent » n'est nécessaire.
- Pour que la commande apparaisse instantanément : active le *Mode développeur* de Discord
  (Paramètres → Avancés), clic droit sur ton serveur → *Copier l'identifiant du serveur* → `GUILD_ID`.

**Inviter le bot** (remplace `TON_CLIENT_ID`) :

```
https://discord.com/oauth2/authorize?client_id=TON_CLIENT_ID&scope=bot+applications.commands&permissions=3146752
```

(`3146752` = Voir le salon + Se connecter + Parler.)

## Lancer

```
npm run register     # une seule fois : déclare la commande /timer
npm start            # lance le bot (ou double-clique sur start.bat sous Windows)
```

Le bot n'est actif que tant que le programme tourne. Pour qu'il soit disponible en permanence,
héberge-le sur une machine toujours allumée (VPS, Raspberry Pi, etc.).

## Utiliser

Rejoins un salon vocal, puis tape dans un salon texte :

| Commande | Effet |
|---|---|
| `/timer test` | Dit la phrase une fois, tout de suite : vérifie que tu entends le bot |
| `/timer start` | Timer par défaut : toutes les 5 min pendant 60 min |
| `/timer start intervalle:2 duree:30 message:Pense à boire de l'eau` | Personnalisé |
| `/timer start premiere_annonce:1` | Première annonce dans 1 min, puis toutes les `intervalle` min |
| `/timer status` | Prochaine annonce, nombre d'annonces faites, fin du timer |
| `/timer stop` | Arrête et quitte le salon |

À la fin de la durée, le bot quitte tout seul le salon.

### Qui peut contrôler le timer ?

Un bot Discord ne peut être que dans **un salon vocal par serveur** : il y a donc un seul timer à la fois par serveur.
Quand un timer est en cours, seuls peuvent le modifier ou l'arrêter les membres qui sont **dans le même salon vocal**
que le bot, ou qui ont la permission **Gérer le serveur**. Les autres reçoivent un message qui l'explique.
Tu peux en plus restreindre la commande `/timer` à certains rôles dans *Paramètres du serveur → Intégrations*.

## Voix

- Par défaut : synthèse vocale gratuite (voix neurales Microsoft Edge). Chaque phrase est générée **une seule fois**
  puis gardée dans `cache/` : aucun délai pendant le timer.
- Change de voix avec `TTS_VOICE` dans `.env` (ex. `fr-FR-HenriNeural`, `en-US-JennyNeural`), de vitesse avec `TTS_RATE` (ex. `+10%`).
- **Ton propre son** : mets un fichier mp3 ou wav dans `audio/` et indique-le dans `.env` : `AUDIO_FILE=audio/mon-son.mp3`.
  Ce son sera joué à chaque annonce, à la place de la synthèse vocale. C'est aussi la solution de secours si le
  service vocal (non officiel) devient indisponible. Le dossier `audio/` n'est pas publié sur GitHub.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| La commande `/timer` n'apparaît pas | `npm run register` pas lancé, ou mauvais `GUILD_ID`/`CLIENT_ID`. Sans `GUILD_ID`, compte jusqu'à 1 h. `Ctrl+R` dans Discord. |
| « Rejoins d'abord un salon vocal » | Tu dois être dans un salon vocal quand tu lances la commande. |
| « Il me manque une permission » | Le bot doit avoir Voir le salon, Se connecter et Parler dans ce salon. |
| « Un timer tourne déjà dans… » | Rejoins le salon du bot, ou demande à un modérateur de faire `/timer stop`. |
| « Synthèse vocale impossible » | Pas d'internet, ou service Edge indisponible : utilise `AUDIO_FILE`. |
| `Cannot find module` | Lance `npm install` dans ce dossier. |
| Erreur de version Node | Il faut Node 22.12 ou plus. |

## Développement

`npm test` lance les tests automatiques (planning des annonces, droits de contrôle, cache de voix, lecture audio).

## Licence

MIT, voir `LICENSE`.
