/*:
 * @plugindesc (Ver 1.5) Map sprite talking animation for RPG Maker MV / MZ
 * @author ODUE
 * @url https://github.com/00due/talkanimation
 * @target MZ MV
 * 
 * @help
 * Using the plugin:
 * You have to have currentcharactername[talk].png in img/characters folder.
 * The animated talking frames are the walking frames.
 * Make sure you aren't using direction fix on the event or the player, or else the
 * talking animation won't play.
 * Use \atalk[actorId] or \etalk[eventId] in the message box to start the animation.
 * In atalk, actor ID 0 means the player. The rest means the party members in order.
 * In etalk, event ID 0 means the event that is currently running.
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
 * @desc Higher number means faster animation. Recommended values are between 1 and 10.
 * @type number
 * @default 5
 * @param animStop
 * @text Longer animation
 * @desc Select whether the animation should stop when text showing animation is finished or some frames after.
 * @type boolean
 * @default false
 * @on Longer animation
 * @off When text is finsihed
 * @param timeoutFrames
 * @text Frames after text pause
 * @desc Frames before animation is stopped. Only used if Longer animation is on. 0 = keep playing until textbox is closed.
 * @type number
 * @default 60
 * @param shortCodes
 * @text shortened text codes
 * @desc Allows use of \at and \et for faster use. May conflict with other plugins. Use at your own risk.
 * @type boolean
 * @default false
 * @param subDir
 * @text directory for talk sprites
 * @desc If you want to use subdirectory for talk sprites, put the name of a directory here.
 * @type string
 * @default 
*/
(() => {
    const parameters = PluginManager.parameters('ODUE_talkanimation');

    let moveSpeed = parseInt(parameters['moveSpeed']);
    const longAnimation = parameters['animStop'] === 'true';
    const timeoutFrames = parseInt(parameters['timeoutFrames']);
    const shortCodes = parameters['shortCodes'] === 'true';
    const subDir = parameters['subDir'];

    let talkAnimation = false;
    let talkAnimMode;
    let talkerId;
    let talkerFilename;
    let originalMoveSpeed;
    let talkerIndex;
    let animAllowed = false; // This is due to compability issues with "Set stepping animation"
    let etalkMatch;
    let atalkMatch;
    let atalkContinue = false;

    let animationTimeout = null;

    const loadImage = (src) => {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = (error) => reject(error);
          image.src = src;
        });
    };

    toggleTalkAnimation = function(toggle) {
        animAllowed = true;
        if (talkAnimMode === 0) {
            const partyMember = talkerId === 0 ? $gamePlayer : $gamePlayer.followers().follower(talkerId - 1);
            talkerIndex = partyMember.characterIndex();
            if (toggle) { 
                if (!atalkContinue) {
                    originalMoveSpeed = $gamePlayer.moveSpeed();
                    partyMember.setMoveSpeed(moveSpeed);
                    talkerFilename = partyMember.characterName();
                    talkerFilename = talkerFilename.replace(/\[talk\]\.png/g, '');
                    const imageSrc = "img/characters/" + subDir + talkerFilename + "[talk].png";
                    ImageManager.loadCharacter(subDir + talkerFilename + "[talk]");
                    loadImage(imageSrc)
                    .then((image) => {
                        $gameParty.members()[talkerId].setCharacterImage(subDir + talkerFilename + "[talk]", talkerIndex);
                        partyMember.refresh();
                        partyMember.enableSteppingAnimation();
                    })
                    .catch((error) => {
                        console.error("Failed to load image:", error);
                    });
                } else {
                    partyMember.setMoveSpeed(moveSpeed);
                    partyMember.enableSteppingAnimation();
                }
                                
            } else { 
                partyMember.disableSteppingAnimation();
                talkerFilename = talkerFilename.replace(subDir, '');
                if (!atalkContinue) {
                    partyMember.straighten();
                    if ($gameParty.members()[talkerId])
                        $gameParty.members()[talkerId].setCharacterImage(talkerFilename, talkerIndex);
                    partyMember.refresh();
                    partyMember.setMoveSpeed(originalMoveSpeed);
                }
                
            }
        } else if (talkAnimMode === 1) {
            if (talkerId === 0) talkerId = $gameMap._interpreter._eventId;
            if (!$gameMap.event(talkerId)) return;
            const event = $gameMap.event(talkerId);
            if (toggle) {
                originalMoveSpeed = event.moveSpeed();
                event.setMoveSpeed(moveSpeed);
                talkerFilename = event.characterName();
                /*const newImage = new Image();
                newImage.src = "img/characters/" + talkerFilename + "[talk].png";
                newImage.onload = function() {
                    event.setImage(talkerFilename + "[talk]", event.characterIndex());
                    event.refresh();
                    event.setStepAnime(true);
                }*/
                talkerFilename = talkerFilename.replace(/\[talk\]\.png/g, '');
                const imageSrc = "img/characters/" + subDir + talkerFilename + "[talk].png";
                ImageManager.loadCharacter(subDir + talkerFilename + "[talk]");
                loadImage(imageSrc)
                .then((image) => {
                    event.setImage(subDir + talkerFilename + "[talk]", event.characterIndex());
                    event.refresh();
                    event.setStepAnime(true);
                })
                .catch((error) => {
                    console.error("Failed to load image:", error);
                });
            }
            else {
                if (event) {
                    event.setStepAnime(false);
                    event.setMoveSpeed(originalMoveSpeed);
                    event.setPattern(1);
                    event.resetPattern();   //I have no idea if this helps with the occassional showing of
                                            //the walking animation, so I've left it here just in case.
                    event.setImage(talkerFilename.replace(subDir, ''), event.characterIndex());
                    event.refresh();
                }
                animAllowed = false;
            }
        }
        talkAnimation = toggle;
        return;
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

        etalkMatch = text.match(/\\etalk\[(\d+)\]/i);
        atalkMatch = text.match(/\\atalk\[(\d+)\]/i);
        if (shortCodes) {
            etalkMatch = text.match(/\\et\[(\d+)\]/i);
            atalkMatch = text.match(/\\at\[(\d+)\]/i);
        }

        if (etalkMatch) {
            if (animationTimeout) clearTimeout(animationTimeout);
            talkAnimation = true;
            talkAnimMode = 1; //event
            talkerId = parseInt(etalkMatch[1]);
        } else if (atalkMatch) {
            if (animationTimeout) clearTimeout(animationTimeout);
            talkAnimation = true;
            talkAnimMode = 0; //actor
            talkerId = parseInt(atalkMatch[1]);
        }

        if (etalkMatch || atalkMatch) text = text.replace(/\\[ae]talk\[\d+\]/gi, "");
        if ((etalkMatch || atalkMatch) && shortCodes) text = text.replace(/\\[ae]t\[\d+\]/gi, "");
        if (talkAnimation) {
            if (animationTimeout) clearTimeout(animationTimeout);
            toggleTalkAnimation(true);
        }
        return Window_Message_prototype_convertEscapeCharacters.call(this, text);
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