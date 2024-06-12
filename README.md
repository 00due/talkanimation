# Talk animation
 Undertale-like talking animation for RPG Maker MZ / MV!

# Download
 https://github.com/00due/talkanimation/archive/refs/heads/master.zip

 Current version: 1.0

 After downloading, extract the `ODUE_talkanimation.js` file into `<your project's folder>/js/plugins`

# Upgrading from version 1.5 to later
 The way \atalk works has been changed. Previously it checked the member position in party, but now it plays the animation based on actor ID.
 Don't worry, you don't need to update your whole project. You can restore the functionality to how it was previuously:

 Set the parameter "Use party position" as true.

 If you want to change it to the new style without upgrading the whole project, use `\useActorId` in a text and after that, start using actor IDs instead of party member positions.

# Troubleshooting

 Please submit your issue into [Github issues](https://github.com/00due/talkanimation/issues).

# Using the plugin:
 You have to have currentcharactername[talk].png in img/characters folder.

 The animated talking frames are the walking frames.

 Make sure you aren't using direction fix on the event or the player, or else the talking animation won't play.

 Use `\atalk[actorId]` or `\etalk[eventId]` in the message box to start the animation.

 In atalk, actor ID 0 means the player. The rest means the actor ID (set in database).
 Or if you have "Use party position" on, the ID is the position in the party.
 For example `\atalk[1]` will animate the first actor after the player in the party.
 
 In etalk, event ID 0 means the event that is currently running.
 
 You can also use \usePartyPos and \useActorId to change the behavior of the plugin
 (see "Use party position" parameter for more info).

 Compability with VisuMZ_2_MessageLog:

 - Use VisuMZ_1_MessageCore to replace \atalk and \etalk with nothing.


 Terms of use:

 1. You must give credit to ODUE

 2. You can freely edit this plugin to your needs. However, you must still credit me.

 3. This plugin is free for commercial and non-commercial projects.

 4. This plugin is provided as is. I'm not responsible for anything you make with this plugin.

 5. You can send feature requests to me on platforms such as Reddit (to u/SanttuPOIKA----).
    However, I have no obligation to fulfill your requests.
