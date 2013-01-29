const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const TranslatorDialog = Me.imports.translator_dialog;
const StatusBar = Me.imports.status_bar;
const LanguageChooser = Me.imports.language_chooser;
const TranslatorsManager = Me.imports.translators_manager;
const PrefsKeys = Me.imports.prefs_keys;

ExtensionUtils.get_text_translator_extension = function() {
    return Me;
}

function launch_extension_prefs(uuid) {
    let appSys = Shell.AppSystem.get_default();
    let app = appSys.lookup_app('gnome-shell-extension-prefs.desktop');
    app.launch(global.display.get_current_time_roundtrip(),
               ['extension:///' + uuid], -1, null);
}

const TIMEOUT_IDS = {
    instant_translation: 0
}

const TRIGGERS = {
    translate: true
};

const TranslatorExtension = new Lang.Class({
    Name: 'TranslatorExtension',

    _init: function() {
        this._dialog = new TranslatorDialog.TranslatorDialog();
        this._dialog.source.clutter_text.connect('text-changed',
            Lang.bind(this, function() {
                let enable_instant_translation = Utils.SETTINGS.get_boolean(
                    PrefsKeys.INSTANT_TRANSLATION_KEY
                );
                if(!enable_instant_translation) return;

                this._remove_timeouts('instant_translation');

                if(TRIGGERS.translate) {
                    TIMEOUT_IDS.instant_translation = Mainloop.timeout_add(500,
                        Lang.bind(this, this._translate)
                    );
                }
                else {
                    TRIGGERS.translate = true;
                }
            })
        );
        this._dialog.dialog_layout.connect('key-press-event', Lang.bind(this,
            this._on_key_press_event
        ));
        this._translators_manager = new TranslatorsManager.TranslatorsManager();

        this._dialog.source.max_length =
            this._translators_manager.current.limit;

        this._add_topbar_buttons();
        this._add_bottombar_buttons();

        this._source_language_chooser = new LanguageChooser.LanguageChooser(
            'Choose source language:'
        );
        this._source_language_chooser.connect('language-chose', Lang.bind(this,
            this._on_source_language_chose
        ));

        this._target_language_chooser = new LanguageChooser.LanguageChooser(
            'Choose target language:'
        );
        this._target_language_chooser.connect('language-chose', Lang.bind(this,
            this._on_target_language_chose
        ));

        this._set_current_languages();
    },

    _remove_timeouts: function(timeout_key) {
        if(!Utils.is_blank(timeout_key)) {
            if(TIMEOUT_IDS[timeout_key] > 0) {
                Mainloop.source_remove(TIMEOUT_IDS[timeout_key]);
            }
        }
        else {
            for(let key in TIMEOUT_IDS) {
                if(TIMEOUT_IDS[key] > 0) {
                    Mainloop.source_remove(TIMEOUT_IDS[key]);
                }
            }
        }
    },

    _on_key_press_event: function(object, event) {
        let state = event.get_state();
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Escape) {
            this.close();
        }
        // ctrl+return - translate text
        else if(
            state == Clutter.ModifierType.CONTROL_MASK &&
            symbol == Clutter.Return
        ) {
            this._translate();
        }
        // ctrl+shift+c - copy translated text to clipboard
        else if(
            state == Clutter.ModifierType.SHIFT_MASK +
            Clutter.ModifierType.CONTROL_MASK &&
            symbol == 67
        ) {
            let text = this._dialog.target.text;

            if(Utils.is_blank(text)) {
                this._dialog.statusbar.add_message(
                    'There is nothing to copy.',
                    1500,
                    StatusBar.MESSAGE_TYPES.error,
                    false
                );
            }
            else {
                let clipboard = St.Clipboard.get_default();
                clipboard.set_text(text);
                this._dialog.statusbar.add_message(
                    'Translated text copied to clipboard.',
                    1500,
                    StatusBar.MESSAGE_TYPES.info,
                    false
                );
            }
        }
        // ctr+s - swap languages
        else if(
            state == Clutter.ModifierType.CONTROL_MASK &&
            symbol == 115
        ) {
            this._swap_languages();
        }
        // ctrl+d - reset languages to default
        else if(
            state == Clutter.ModifierType.CONTROL_MASK &&
            symbol == 100
        ) {
            this._reset_languages()
        }
        else {
            // log(state+':'+symbol);
        }
    },

    _set_current_languages: function() {
        let current = this._translators_manager.current;

        if(current.remember_last_used) {
            this._current_source_lang =
                current.last_source !== false
                ? current.last_source
                : current.default_source;
            this._current_target_lang =
                current.last_target
                ? current.last_target
                : current.default_target;
        }
        else {
            this._current_source_lang = current.default_source;
            this._current_target_lang = current.default_target;
        }

        this._current_langs_changed();
    },

    _swap_languages: function() {
        let current = this._translators_manager.current;
        [this._current_source_lang, this._current_target_lang] =
            [this._current_target_lang, this._current_source_lang];
        current.last_source = this._current_source_lang;
        current.last_target = this._current_target_lang;
        this._current_langs_changed();
    },

    _reset_languages: function() {
        let current = this._translators_manager.current;
        this._current_source_lang = current.default_source;
        this._current_target_lang = current.default_target;
        current.last_source = this._current_source_lang;
        current.last_target = this._current_target_lang;
        this._current_langs_changed();
    },

    // _show_help: function() {
    //     let help_dialog = new Me.imports.help_dialog.HelpDialog;
    //     help_dialog.open();
    // },

    _on_source_language_chose: function(object, language) {
        this._current_source_lang = language.code;
        this._translators_manager.current.last_source = language.code;
        this._current_langs_changed();
        this._source_language_chooser.close();
    },

    _on_target_language_chose: function(object, language) {
        this._current_target_lang = language.code;
        this._translators_manager.current.last_target = language.code;
        this._current_langs_changed();
        this._target_language_chooser.close();
    },

    _current_langs_changed: function() {
        this._source_lang_button.label =
            '<u>From: %s</u>'.format(
                this._translators_manager.current.get_language_name(
                    this._current_source_lang
                )
            );
        this._target_lang_button.label =
            '<u>To: %s</u>'.format(
                this._translators_manager.current.get_language_name(
                    this._current_target_lang
                )
            );
    },

    _get_source_lang_button: function() {
        let button_params = {
            style_class: 'tranlator-top-bar-button-reactive'
        };
        let button = this._dialog.topbar.new_button(
            false,
            '<u>From: %s</u>'.format(
                this._translators_manager.current.get_language_name(
                    this._current_source_lang
                )
            ),
            button_params,
            Lang.bind(this, function() {
                this._source_language_chooser.open();
                this._source_language_chooser.set_languages(
                    this._translators_manager.current.get_languages()
                );
                this._source_language_chooser.show_languages(
                    this._current_source_lang
                );
            })
        );
        let message_id;

        button.connect('enter-event', Lang.bind(this, function() {
            message_id = this._dialog.statusbar.add_message(
                'Choose source language'
            );
        }));
        button.connect('leave-event', Lang.bind(this, function() {
            this._dialog.statusbar.remove_message(message_id);
        }));

        return button;
    },

    _get_target_lang_button: function() {
        let button_params = {
            style_class: 'tranlator-top-bar-button-reactive'
        };
        let button = this._dialog.topbar.new_button(
            false,
            '<u>To: %s</u>'.format(
                this._translators_manager.current.get_language_name(
                    this._current_target_lang
                )
            ),
            button_params,
            Lang.bind(this, function() {
                this._target_language_chooser.open();
                this._target_language_chooser.set_languages(
                    this._translators_manager.current.get_pairs(
                        this._current_source_lang
                    )
                );
                this._target_language_chooser.show_languages(
                    this._current_target_lang
                );
            })
        );
        let message_id;

        button.connect('enter-event', Lang.bind(this, function() {
            message_id = this._dialog.statusbar.add_message(
                'Choose target language'
            );
        }));
        button.connect('leave-event', Lang.bind(this, function() {
            this._dialog.statusbar.remove_message(message_id);
        }));

        return button;
    },

    _get_swap_langs_button: function() {
        let button_params = {
            style_class: 'tranlator-top-bar-button-reactive'
        };
        let button = this._dialog.topbar.new_button(
            false,
            ' <u>\u21C4</u> ',
            button_params,
            Lang.bind(this, this._swap_languages)
        );
        let message_id;

        button.connect('enter-event', Lang.bind(this, function() {
            message_id = this._dialog.statusbar.add_message(
                'Swap languages'
            );
        }));
        button.connect('leave-event', Lang.bind(this, function() {
            this._dialog.statusbar.remove_message(message_id);
        }));

        return button;
    },

    _get_translators_button: function() {
        let button;

        if(this._translators_manager.num_translators < 2) {
            button = this._dialog.topbar.new_label(
                this._translators_manager.current.name,
                'tranlator-top-bar-button'
            );
        }
        else {
            let button_params = {
                style_class: 'tranlator-top-bar-button-reactive'
            };
            button = this._dialog.topbar.new_button(
                false,
                '<u>%s</u>'.format(this._translators_manager.current.name),
                button_params,
                Lang.bind(this, function() {
                    let popup = new PopupMenu.PopupMenu(
                        button.actor,
                        0,
                        St.Side.TOP
                    );
                    Main.uiGroup.add_actor(popup.actor);

                    let names = this._translators_manager.translators_names;

                    for(let i = 0; i < names.length; i++) {
                        if(names[i] === this._translators_manager.current.name) {
                            continue;
                        }

                        let item = new PopupMenu.PopupMenuItem(names[i]);
                        item.connect('activate', Lang.bind(this, function(item) {
                            let name = item.label.get_text();

                            button.label = '<u>%s</u>'.format(name);

                            this._translators_manager.current = name;
                            this._dialog.source.max_length =
                                this._translators_manager.current.limit;
                            this._set_current_languages();

                            this._dialog.source.grab_key_focus();
                        }))
                        popup.addMenuItem(item);
                    }

                    popup.open(true);
                })
            );
            let message_id;

            button.connect('enter-event', Lang.bind(this, function() {
                message_id = this._dialog.statusbar.add_message(
                    'Choose translation provider'
                );
            }));
            button.connect('leave-event', Lang.bind(this, function() {
                this._dialog.statusbar.remove_message(message_id);
            }));
        }

        return button;
    },

    _get_translate_button: function() {
        let button_params = {
            style_class: 'tranlator-top-bar-go-button'
        };
        let button = this._dialog.topbar.new_button(
            false,
            'Go!',
            button_params,
            Lang.bind(this, this._translate)
        );

        let message_id;

        button.connect('enter-event', Lang.bind(this, function() {
            message_id = this._dialog.statusbar.add_message(
                'Translate text(<Ctrl><Enter>)'
            );
        }));
        button.connect('leave-event', Lang.bind(this, function() {
            this._dialog.statusbar.remove_message(message_id);
        }));

        return button;
    },

    _get_instant_translation_button: function() {
        let button_params = {
            style_class: 'translator-bottom-toggle-button',
            toggle_mode: true
        };

        let button = this._dialog.bottombar.new_button(
            Utils.ICONS.instant_translation,
            'Enable/Disable instant translation',
            button_params,
            Lang.bind(this, function() {
                let checked = button.get_checked();
                button.set_checked(checked);

                Utils.SETTINGS.set_boolean(
                    PrefsKeys.INSTANT_TRANSLATION_KEY,
                    checked
                )
            })
        );
        let checked = Utils.SETTINGS.get_boolean(
            PrefsKeys.INSTANT_TRANSLATION_KEY
        );
        button.set_checked(checked);

        return button;
    },

    // _get_help_button: function() {
    //     let button_params = {
    //         style_class: 'translator-bottom-button'
    //     };

    //     let button = this._dialog.bottombar.new_button(
    //         Utils.ICONS.help,
    //         'Help',
    //         button_params,
    //         Lang.bind(this, this._show_help));

    //     return button;
    // },

    _get_prefs_button: function() {
        let button_params = {
            style_class: 'translator-bottom-button'
        };
        let button = this._dialog.bottombar.new_button(
            Utils.ICONS.preferences,
            'Preferences',
            button_params,
            Lang.bind(this, function() {
                this.close();
                launch_extension_prefs(Me.uuid);
            })
        );

        return button;
    },

    _get_close_button: function() {
        let button_params = {
            style_class: 'translator-bottom-button'
        };
        let button = this._dialog.bottombar.new_button(
            Utils.ICONS.shutdown,
            'Quit',
            button_params,
            Lang.bind(this, function() {
                this.close();
            })
        );

        return button;
    },

    _add_topbar_buttons: function() {
        let translate_label = this._dialog.topbar.new_label(
            'Translate ',
            'tranlator-top-bar-button'
        );
        this._dialog.topbar.add_button(translate_label);

        this._source_lang_button = this._get_source_lang_button();
        this._dialog.topbar.add_button(this._source_lang_button);

        this._swap_languages_button = this._get_swap_langs_button();
        this._dialog.topbar.add_button(this._swap_languages_button);

        this._target_lang_button = this._get_target_lang_button();
        this._dialog.topbar.add_button(this._target_lang_button);

        let by_label = this._dialog.topbar.new_label(
            ' by ',
            'tranlator-top-bar-button'
        );
        this._dialog.topbar.add_button(by_label);

        this._translators_button = this._get_translators_button()
        this._dialog.topbar.add_button(this._translators_button);

        let translate_label = this._dialog.topbar.new_label(
            ' ',
            'tranlator-top-bar-button'
        );
        this._dialog.topbar.add_button(translate_label);

        this._translate_button = this._get_translate_button();
        this._dialog.topbar.add_button(this._translate_button);
    },

    _add_bottombar_buttons: function() {
        let instant_translation_button = this._get_instant_translation_button();
        this._dialog.bottombar.add_button(instant_translation_button);

        // let help_button = this._get_help_button();
        // this._dialog.bottombar.add_button(help_button);

        let prefs_button = this._get_prefs_button();
        this._dialog.bottombar.add_button(prefs_button);

        let close_button = this._get_close_button();
        this._dialog.bottombar.add_button(close_button);
    },

    _translate: function() {
        if(Utils.is_blank(this._dialog.source.text)) return;

        this._dialog.target.text = '';
        let message_id = this._dialog.statusbar.add_message(
            'Translating...',
            0,
            StatusBar.MESSAGE_TYPES.info,
            true
        );

        this._translators_manager.current.translate(
            this._current_source_lang,
            this._current_target_lang,
            this._dialog.source.text,
            Lang.bind(this, function(result) {
                this._dialog.statusbar.remove_message(message_id);

                if(result.error) {
                    this._dialog.statusbar.add_message(
                        result.message,
                        4000,
                        StatusBar.MESSAGE_TYPES.error
                    );
                }
                else {
                    this._dialog.target.markup ='%s'.format(result);
                }
            })
        );
    },

    _translate_from_clipboard: function() {
        this.open();

        let clipboard = St.Clipboard.get_default();
        clipboard.get_text(Lang.bind(this, function(clipboard, text) {
            if(Utils.is_blank(text)) {
                this._dialog.statusbar.add_message(
                    'Clipboard is empty.',
                    2000,
                    StatusBar.MESSAGE_TYPES.error,
                    false
                );
                return;
            }

            TRIGGERS.translate = false;
            this._dialog.source.text = text;
            this._translate();
        }))
    },

    _translate_from_selection: function() {
        this.open();

        let text = Utils.get_primary_selection();

        if(Utils.is_blank(text)) {
            this._dialog.statusbar.add_message(
                'Primary selection is empty.',
                2000,
                StatusBar.MESSAGE_TYPES.error,
                false
            );
            return;
        }

        TRIGGERS.translate = false;
        this._dialog.source.text = text;
        this._translate();
    },

    _add_keybindings: function() {
        global.display.add_keybinding(
            PrefsKeys.OPEN_TRANSLATOR_KEY,
            Utils.SETTINGS,
            Meta.KeyBindingFlags.NONE,
            Lang.bind(this, function() {
                this.open();
            })
        );
        global.display.add_keybinding(
            PrefsKeys.TRANSLATE_FROM_CLIPBOARD_KEY,
            Utils.SETTINGS,
            Meta.KeyBindingFlags.NONE,
            Lang.bind(this, function() {
                this._translate_from_clipboard();
            })
        );
        global.display.add_keybinding(
            PrefsKeys.TRANSLATE_FROM_SELECTION_KEY,
            Utils.SETTINGS,
            Meta.KeyBindingFlags.NONE,
            Lang.bind(this, function() {
                this._translate_from_selection();
            })
        );
    },

    _remove_keybindings: function() {
        global.display.remove_keybinding(PrefsKeys.OPEN_TRANSLATOR_KEY);
        global.display.remove_keybinding(PrefsKeys.TRANSLATE_FROM_CLIPBOARD_KEY)
        global.display.remove_keybinding(PrefsKeys.TRANSLATE_FROM_SELECTION_KEY);
    },

    _add_panel_button: function() {
        let label = new St.Label({
            text: 'T',
            style_class: 'translator-panel-button',
            reactive: true,
            track_hover: true
        });

        this._panel_button = new St.Button({
            x_fill: true,
            y_fill: false
        });
        this._panel_button.add_actor(label);
        this._panel_button.connect(
            'button-press-event',
            Lang.bind(this, this.open)
        );

        Main.panel._rightBox.insert_child_at_index(this._panel_button, 0);
    },

    _remove_panel_button: function() {
        Main.panel._rightBox.remove_child(this._panel_button);
        this._panel_button.destroy();
        this._panel_button = false;
    },

    open: function() {
        this._dialog.open();
        this._dialog.source.clutter_text.set_selection(
            0,
            this._dialog.source.length
        );
        this._dialog.source.clutter_text.grab_key_focus();
        this._dialog.source.max_length = this._translators_manager.current.limit;
        this._set_current_languages();

        if(this._panel_button) {
            let label = this._panel_button.get_first_child();
            label.remove_style_pseudo_class('hover');
        }
    },

    close: function() {
        this._dialog.close();
    },

    enable: function() {
        if(Utils.SETTINGS.get_boolean(PrefsKeys.SHOW_ICON_KEY)) {
            if(!this._panel_button) {
                this._add_panel_button();
            }
        }

        Utils.SETTINGS.connect('changed::'+PrefsKeys.SHOW_ICON_KEY,
            Lang.bind(this, function() {
                let show = Utils.SETTINGS.get_boolean(PrefsKeys.SHOW_ICON_KEY);

                if(show && !this._panel_button) this._add_panel_button();
                if(!show) this._remove_panel_button();
            })
        );

        this._add_keybindings();
    },

    disable: function() {
        this.close();
        this._dialog.destroy();
        this._remove_keybindings();

        if(this._panel_button !== false) {
            this._remove_panel_button();
        }
    }
});

let translator = null;

function init() {
    // nothing
}

function enable() {
    translator = new TranslatorExtension();
    translator.enable();
}

function disable() {
    if(translator !== null) {
        translator.disable();
        translator = null;
    }
}
