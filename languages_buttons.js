const St = imports.gi.St;
const Lang = imports.lang;
const Signals = imports.signals;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const ButtonsBar = Me.imports.buttons_bar;

const Gettext = imports.gettext.domain('text_translator');
const _ = Gettext.gettext;

const LanguagesButtons = new Lang.Class({
    Name: 'LanguagesButtons',

    _init: function(languages) {
        this._langs = languages || [];

        this._box = new St.BoxLayout();
        this._label = new St.Label({
            text: _("There will appear the most used languages."),
            style_class: "translator-langs-buttons-label"
        });
        this.buttons = new ButtonsBar.ButtonsBar({
            style_class: 'translator-langs-buttons-box'
        });
        this.buttons.actor.hide();
        this._box.add_actor(this._label);
        this._box.add_actor(this.buttons.actor);

        this._show_buttons();
    },

    _show_buttons: function() {
        if(this._langs.length > 0) {
            this._label.hide();
            this.buttons.actor.show();

            for(let i = 0; i < this._langs.length; i++) {
                let button_params = {
                    button_style_class: 'translator-lang-button',
                    box_style_class: 'translator-lang-button-box',
                    toggle_mode: true
                }
                let button = new ButtonsBar.ButtonsBarButton(
                    false,
                    this._langs[i].lang_name,
                    '',
                    button_params
                );
                this._langs[i].button = button;
                let lang_data = this._langs[i];
                button.connect("clicked", Lang.bind(this, function() {
                    this.emit("clicked", lang_data);
                }));
                this.buttons.add_button(button);
            }
        }
        else {
            this._label.show();
        }
    },

    reload: function() {
        this.buttons.clear();
        this._show_buttons();
    },

    add_languages: function(new_langs) {
        this._langs = this._langs.concat(new_langs);
        this.reload();
    },

    set_languages: function(new_langs) {
        this._langs = new_langs;
        this.reload();
    },

    select: function(lang_code) {
        for(let i = 0; i < this._langs.length; i++) {
            let lang = this._langs[i];

            if(lang.lang_code === lang_code) {
                lang.button.set_checked(true);
                this.emit("selected", lang);
            }
            else {
                lang.button.set_checked(false);
            }
        }
    },

    destroy: function() {
        this._langs = null;
        this._box.destroy();
    },

    get actor() {
        return this._box;
    },

    get languages() {
        return this._langs;
    }
});
Signals.addSignalMethods(LanguagesButtons.prototype);
