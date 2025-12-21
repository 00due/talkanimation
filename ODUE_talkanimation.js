/*:
 * @plugindesc (Ver 1.8.1) Map sprite talking animation for RPG Maker MV / MZ
 * @author ODUE
 * @url https://github.com/00due/talkanimation
 * @target MZ MV
 * 
 * @help
 * -------------------------------------------------------
 * IF YOU'RE UPGRADING FROM VERSION 1.5 TO LATER VERSIONS,
 * MAKE SURE TO READ THE GITHUB / RPG MAKER FORUMS POST!!!
 * -------------------------------------------------------
 * 
 * 
 * Using the plugin:
 * You have to have currentcharactername[talk].png in img/characters folder.
 * The animated talking frames are the walking frames.
 * Make sure you aren't using direction fix on the event or the player, or else the
 * talking animation won't play.
 * Use \atalk[actorId] or \etalk[eventId] in the message box to start the animation.
 * In atalk, actor ID 0 means the player. The rest means the actor ID (set in database).
 * Or if you have "Use party position" on, the ID is the position in the party.
 * For example \atalk[1] will animate the first actor after the player in the party.
 * In etalk, event ID 0 means the event that is currently running.
 * 
 * You can also use \mtalk[actorId] or for party members' position. This needs to be enabled in the plugin parameters.
 * 
 * Subdirectory setup:
 * Use folder/ (remember the / character). This will use img/characters/folder/ as the directory.
 * 
 * Compability with VisuMZ_2_MessageLog:
 * - Use VisuMZ_1_MessageCore to  replace \atalk and \etalk with nothing.
 * 
 * 
 * Terms of use:
 *
 * 1. You must give credit to ODUE
 * 2. You can freely edit this plugin to your needs. However, you must still credit me.
 * 3. This plugin is free for commercial and non-commercial projects.
 * 4. This plugin is provided as is. I'm not responsible for anything you make with this plugin.
 * 5. You can send feature requests to me on platforms such as Reddit (to u/SanttuPOIKA----).
 *    However, I have no obligation to fulfill your requests.
 * 
 * @param moveSpeed
 * @text Animation speed
 * @desc Higher number means faster animation. Recommended values are between 2 and 8.
 * @type number
 * @default 5
 * @min 2
 * max 10
 * 
 * @param animStop
 * @text Longer animation
 * @desc Select whether the animation should stop when text showing animation is finished or some frames after.
 * @type boolean
 * @default false
 * @on Longer animation
 * @off When text is finsihed
 * 
 * @param timeoutFrames
 * @text Frames after text pause
 * @desc Frames before animation is stopped. Only used if Longer animation is on. 0 = keep playing until textbox is closed.
 * @type number
 * @default 60
 * 
 * @param shortCodes
 * @text shortened text codes
 * @desc Allows use of \at and \et for faster use. May conflict with other plugins. Use at your own risk.
 * @type boolean
 * @default false
 * 
 * @param subDir
 * @text directory for talk sprites
 * @desc If you want to use subdirectory for talk sprites, put the name of a directory here.
 * @type string
 * @default 
 * 
 * @param allowMemberTalk
 * @text Member talk
 * @desc Allow using \mtalk (\mt with short codes) for party members' position
 * @type boolean
 * @default false
 * 
 * @param reverseam
 * @text Reverse mtalk / atalk
 * @desc Switch the behavior of \mtalk and \atalk. Use for compability with older versions.
 * @type boolean
 * @default false
 * 
 * @command talkAnimation
*/
(() => {
    const parameters = PluginManager.parameters('ODUE_talkanimation');

    const longAnimation = parameters['animStop'] === 'true';
    const timeoutFrames = parseInt(parameters['timeoutFrames']);
    const shortCodes = parameters['shortCodes'] === 'true';
    const subDir = parameters['subDir'];
    let moveSpeed = parseInt(parameters['moveSpeed']);
    const allowMemberTalk = parameters['allowMemberTalk'] === 'true';
    const reverseam = parameters['reverseam'] === 'true';

    let talkAnimation = false;
    let talkAnimMode;
    let talkerId;
    let talkerFilename;
    let originalMoveSpeed;
    let talkerIndex;
    let animAllowed = false; // This is due to compability issues with "Set stepping animation"
    let etalkMatch;
    let atalkMatch;
    let mtalkMatch;
    let atalkContinue = false;
    let mapOfEvent = 0;

    let animationTimeout = null;

    // Store all details of last animated character to make sure it is properly erased
    // before the next one is started.
    let lastAnimated = {
        mode: null,
        id: null,
        filename: null,
        index: null,
        mapId: null,
        speed: null
    };

    const loadImage = (src) => {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = (error) => reject(error);
          image.src = src;
        });
    };

    let getWarningMessage = function(name, type) {
        return `Talk Animation: Removed extra ${type} from character name "${name}".
Please report this to the plugin developer (ODUE) if this happens often.
(Please submit an issue prefereably on GitHub or alternatively to RPG Maker forums. Thank you!)`;
    };

    let showWarning = function(message) {
        if (Utils.isOptionValid('test')) console.warn(message);
    }

    let showError = function(message) {
        if (Utils.isOptionValid('test')) console.error(message);
    }

    //TODO: Break this function into smaller parts (I am scared just by looking at this function)
    let toggleTalkAnimation = function(toggle) {
        try {
            animAllowed = true;
            
            // A new fix to the same problem with wrong filenames being constructed.
            // Even this won't really fix the root cause, but it should at least reduce
            // the chances of it happening (hopefully).
            const getCleanName = (name) => {
                if (!name) return "";
                // 1. Remove [talk] suffix (Note: characterName() does not have .png)
                let clean = name;
                while (clean.includes("[talk]")) {
                    clean = clean.replace("[talk]", "");
                    showWarning(getWarningMessage(name, "suffix"));
                }
                // 2. Remove subDir if the name already starts with it
                // (This should remove all of them)
                while (subDir && subDir.length > 0 && clean.startsWith(subDir)) {
                    clean = clean.substring(subDir.length);
                    showWarning(getWarningMessage(name, "prefix"));
                }
                return clean;
            };

            if (talkAnimMode === 0) {
                const partyMember = talkerId === 0 ? $gamePlayer : $gamePlayer.followers().follower(talkerId - 1);
                // Makes sure the game doesn't crash in case the selected character does not exist.
                if (!partyMember) {
                    showError("Talk Animation: Follower with ID " + talkerId + " not found.");
                    return;
                }
                talkerIndex = partyMember.characterIndex();
                if (toggle) { 
                    const currentName = partyMember.characterName();
                    const isAlreadyTalking = currentName.includes("[talk]");

                    if (!isAlreadyTalking) {
                        originalMoveSpeed = partyMember.moveSpeed();
                        partyMember.setMoveSpeed(partyMember == $gamePlayer ? moveSpeed : moveSpeed - 1);
                        
                        talkerFilename = getCleanName(currentName);
                        
                        const imageSrc = "img/characters/" + subDir + talkerFilename + "[talk].png";
                        ImageManager.loadCharacter(subDir + talkerFilename + "[talk]");
                        loadImage(imageSrc)
                        .then((image) => {
                            if ($gameParty.members()[talkerId]) {
                                // Fixme: This should still check if the requested image
                                // actually exists
                                $gameParty.members()[talkerId].setCharacterImage(subDir + talkerFilename + "[talk]", talkerIndex);
                                partyMember.refresh();
                                partyMember.enableSteppingAnimation();
                            }
                        })
                        .catch((error) => {
                            showError("Failed to load image: " + error);
                        });
                    } else {
                        // The movement speed doesn't stay for party members, so this shitty way
                        // will re-apply it.
                        if (partyMember != $gamePlayer) partyMember.setMoveSpeed(moveSpeed - 1);
                        // Already talking, just ensure animation is on
                        partyMember.enableSteppingAnimation();
                    }
                                    
                } else { 
                    partyMember.disableSteppingAnimation();
                    talkerFilename = getCleanName(talkerFilename || partyMember.characterName()); 
                    
                    if (!atalkContinue) {
                        partyMember.straighten();
                        if ($gameParty.members()[talkerId]) {
                            // Fixme: This too should check if image exists
                            $gameParty.members()[talkerId].setCharacterImage(talkerFilename, talkerIndex);
                            partyMember.refresh();
                            if (originalMoveSpeed !== undefined) partyMember.setMoveSpeed(originalMoveSpeed);
                        }
                    }
                }
            } else if (talkAnimMode === 1) {
                if (talkerId === 0) talkerId = $gameMap._interpreter._eventId;
                const event = $gameMap.event(talkerId);
                if (!event) {
                    showError("Talk Animation: Event with ID " + talkerId + " not found.");
                    return;
                }

                if (toggle) {
                    const currentName = event.characterName();
                    const isAlreadyTalking = currentName.includes("[talk]");

                    if (!isAlreadyTalking) {
                        mapOfEvent = $gameMap.mapId();
                        originalMoveSpeed = event.moveSpeed();
                        event.setMoveSpeed(moveSpeed);
                        
                        talkerFilename = getCleanName(currentName);

                        const imageSrc = "img/characters/" + subDir + talkerFilename + "[talk].png";
                        ImageManager.loadCharacter(subDir + talkerFilename + "[talk]");
                        loadImage(imageSrc)
                        .then((image) => {
                            event.setImage(subDir + talkerFilename + "[talk]", event.characterIndex());
                            event.refresh();
                            event.setStepAnime(true);
                        })
                        .catch((error) => {
                            showError("Failed to load image: " + error);
                        });
                    } else {
                        // Already talking, just ensure animation is on
                        event.setStepAnime(true);
                    }
                }
                else {
                    if (mapOfEvent === $gameMap.mapId()) {
                        event.setStepAnime(false);
                        if (originalMoveSpeed !== undefined) event.setMoveSpeed(originalMoveSpeed);
                        event.setPattern(1);    //TODO: Try removing this (should do exactly same as resetPattern)
                        event.resetPattern();   //I have no idea if this helps with the occassional showing of
                                                //the walking animation, so I've left it here just in case.

                        const currentName = event.characterName();
                        const cleanBase = getCleanName(talkerFilename || currentName);

                        if (currentName.includes(cleanBase) && currentName.includes("[talk]")) {
                            event.setImage(cleanBase, event.characterIndex());
                            event.refresh();
                        }
                    }
                    animAllowed = false;
                }
            }

            // Uodate the info of the last character
            if (toggle) {
                lastAnimated.mode = talkAnimMode;
                lastAnimated.id = talkerId;
                lastAnimated.filename = talkerFilename;
                lastAnimated.index = talkerIndex;
                lastAnimated.mapId = mapOfEvent;
                lastAnimated.speed = originalMoveSpeed;
            } else {
                // After stopping an animation, reset lastAnimated to prevent stale data issues.
                lastAnimated.mode = null;
                lastAnimated.id = null;
                lastAnimated.filename = null;
                lastAnimated.index = null;
                lastAnimated.mapId = null;
                lastAnimated.speed = null;
            }

            talkAnimation = toggle;
            return;
        }
        catch (e) {
            showError(e);
        }
    };

    /*const Window_Message_prototype_updateInput = Window_Message.prototype.updateInput;
    Window_Message.prototype.updateInput = function() {
        if (this.pause && (etalkMatch || atalkMatch)) {
            if (talkAnimation) {
                if (animationTimeout) clearTimeout(animationTimeout);
                toggleTalkAnimation(true);
            }
        };
        return Window_Message_prototype_updateInput.call(this);
    };*/
    
    Window_Message.prototype.updateInput = function() {
        if (this.isAnySubWindowActive()) {
            return true;
        }
        if (this.pause) {
            if (this.isTriggered()) {
                Input.update();
                this.pause = false;
                if (!this._textState) {
                    this.terminateMessage();
                }
                else if (etalkMatch || atalkMatch) {
                    if (animationTimeout) clearTimeout(animationTimeout);
                    toggleTalkAnimation(false);
                    talkAnimation = true;
                    toggleTalkAnimation(true);
                }
            }
            return true;
        }
        return false;
    };

    const Window_Message_prototype_startPause = Window_Message.prototype.startPause;
    Window_Message.prototype.startPause = function() {
        if (atalkMatch) atalkContinue = true;
        if (talkAnimation && !longAnimation) toggleTalkAnimation(false);
        Window_Message_prototype_startPause.call(this);
        if (talkAnimation && longAnimation && timeoutFrames > 0) {
            if (animationTimeout) clearTimeout(animationTimeout);
            animationTimeout = setTimeout(function() {
                toggleTalkAnimation(false);
            }, (timeoutFrames / 60) * 1000);
        }
    };

    //Cancel the animation when in 'Show choices' window
    const Window_ChoiceList_prototype_start = Window_ChoiceList.prototype.start;
    Window_ChoiceList.prototype.start = function() {
        if (atalkMatch) atalkContinue = true;
        if (talkAnimation && !longAnimation) toggleTalkAnimation(false);
        Window_ChoiceList_prototype_start.call(this);
        if (talkAnimation && longAnimation && timeoutFrames > 0) {
            if (animationTimeout) clearTimeout(animationTimeout);
            animationTimeout = setTimeout(function() {
                toggleTalkAnimation(false);
            }, (timeoutFrames / 60) * 1000);
        }
    };

    const Window_Message_prototype_terminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function() {
        if (atalkContinue) {
            atalkContinue = false;
            toggleTalkAnimation(false);
        }
        if (talkAnimation) toggleTalkAnimation(false);
        Window_Message_prototype_terminateMessage.call(this);
    };

    const Window_Message_prototype_convertEscapeCharacters = Window_Message.prototype.convertEscapeCharacters;
    Window_Message.prototype.convertEscapeCharacters = function(text) {
        
        etalkMatch = text.match(/\\etalk\[(\d+)\]/i) || (shortCodes && text.match(/\\et\[(\d+)\]/i));
        atalkMatch = text.match(/\\atalk\[(\d+)\]/i) || (shortCodes && text.match(/\\at\[(\d+)\]/i));
        mtalkMatch = allowMemberTalk ? (text.match(/\\mtalk\[(\d+)\]/i) || (shortCodes && text.match(/\\mt\[(\d+)\]/i))) : null;

        if (etalkMatch || atalkMatch || mtalkMatch) {
            // Make sure to cancel the previous animation properly
            // Fixme: This too is a pretty ugly fix, and should be fixed later.
            // (Who am I kidding, I'm going to just leave this here forever and hope it won't break)
            if (talkAnimation && lastAnimated.id !== null) {
                // Temporarily restore old animation state to stop it correctly
                const currentState = { talkAnimMode, talkerId, talkerFilename, talkerIndex, mapOfEvent, originalMoveSpeed };

                talkAnimMode = lastAnimated.mode;
                talkerId = lastAnimated.id;
                talkerFilename = lastAnimated.filename;
                talkerIndex = lastAnimated.index;
                mapOfEvent = lastAnimated.mapId;
                originalMoveSpeed = lastAnimated.speed;

                toggleTalkAnimation(false);

                // Restore for the new animation
                ({ talkAnimMode, talkerId, talkerFilename, talkerIndex, mapOfEvent, originalMoveSpeed } = currentState);
            }
            
            if (animationTimeout) clearTimeout(animationTimeout);
            talkAnimation = true;

            const usePartyPosition = reverseam;

            if (etalkMatch) {
                talkAnimMode = 1; //event
                talkerId = parseInt(etalkMatch[1]);
            } else if (atalkMatch) {
                talkAnimMode = 0; //actor
                talkerId = parseInt(atalkMatch[1]);
                //Check for party position (because the animation is going to be played based on party position anyway)
                if (!usePartyPosition) {
                    for (let i = 0; i < $gameParty.members().length; i++) {
                        if ($gameParty.members()[i] === $gameActors.actor(talkerId)) {
                            talkerId = i;
                            break;
                        }
                    }
                }
            } else if (mtalkMatch) {
                talkAnimMode = 0; //actor
                //Since atalkMatch is checked in other places, we need to set it here (easier than to set mtalkMatch in other places)
                //I know, this is a bit of a hacky solution, but hey, it works and I'm too lazy to fix it.
                atalkMatch = mtalkMatch;
                talkerId = parseInt(mtalkMatch[1]);
                if (usePartyPosition) {
                    for (let i = 0; i < $gameParty.members().length; i++) {
                        if ($gameParty.members()[i] === $gameActors.actor(talkerId)) {
                            talkerId = i;
                            break;
                        }
                    }
                }
            }
            
            toggleTalkAnimation(true);
        }
        
        // Now, let the original function do its work, but on a cleaned text
        let processedText = text.replace(/\\[aem]talk\[\d+\]/gi, "");
        if (shortCodes) processedText = processedText.replace(/\\[aem]t\[\d+\]/gi, "");

        return Window_Message_prototype_convertEscapeCharacters.call(this, processedText);
    };

    
    const _Game_Follower_initialize = Game_Follower.prototype.initialize;
    Game_Follower.prototype.initialize = function(memberIndex) {
        _Game_Follower_initialize.call(this, memberIndex);
        this._enableSteppingAnimation = false;
    };

    const Game_Follower_prototype_update = Game_Follower.prototype.update;
    Game_Follower.prototype.update = function() {
        if (animAllowed) {
            Game_Character.prototype.update.call(this);
            if (this._enableSteppingAnimation) this.setStepAnime(true);
            else if (this._canDisable) {
                this.setStepAnime(false);
                this._canDisable = false;
                animAllowed = false;
            }
        }
        else Game_Follower_prototype_update.call(this);
    };
    
    Game_Follower.prototype.enableSteppingAnimation = function() {
        this._enableSteppingAnimation = true;
    };
    
    Game_Follower.prototype.disableSteppingAnimation = function() {
        this._enableSteppingAnimation = false;
        this._canDisable = true;
    };
    
    const _Game_Player_initialize = Game_Player.prototype.initialize;
    Game_Player.prototype.initialize = function() {
        _Game_Player_initialize.call(this);
        this._enableSteppingAnimation = false;
    };
    
    const _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        if (animAllowed) {
            
            if (this._enableSteppingAnimation) this.setStepAnime(true);
            else if (this._canDisable) {
                this.setStepAnime(false);
                this._canDisable = false;
                animAllowed = false;
            }
            
        }
    };
    
    Game_Player.prototype.enableSteppingAnimation = function() {
        this._enableSteppingAnimation = true;
    };
    
    Game_Player.prototype.disableSteppingAnimation = function() {
        this._enableSteppingAnimation = false;
        this._canDisable = true;
    };
})();