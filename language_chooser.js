const St = imports.gi.St;
const Lang = imports.lang;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Signals = imports.signals;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;

const COLUMNS = 4;

const LanguageChooser = new Lang.Class({
    Name: 'LanguageChooser',
    Extends: ModalDialog.ModalDialog,

    _init: function(title, languages) {
        this.parent({destroyOnClose: false});

        this._dialogLayout = 
            typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;
        this._dialogLayout.connect('key-press-event', Lang.bind(this,
            this._on_key_press_event
        ));
        this._dialogLayout.set_style_class_name('translator-language-chooser');

        this._languages_table = new St.Table();

        this._box = new St.BoxLayout({
            vertical: true
        });
        this._box.add_actor(this._languages_table);

        this._scroll = new St.ScrollView({
            style_class: 'translator-language-chooser-box'
        });
        this._scroll.add_actor(this._box);

        this._title = new St.Label({
            text: title,
            style_class: 'translator-language-chooser-title'
        });

        this._search_entry = new St.Entry({
            style_class: 'translator-language-chooser-entry',
            visible: false
        });
        this._search_entry.connect('key-press-event', Lang.bind(this, function(o, e) {
            let symbol = e.get_key_symbol();

            if(symbol == Clutter.Escape) {
                this._search_entry.set_text('');
                this._search_entry.hide();
                this._scroll.grab_key_focus();
                this._info_label.show();
                return true;
            }
            else {
                return false;
            }
        }));
        this._search_entry.clutter_text.connect(
            'text-changed',
            Lang.bind(this, this._update_list)
        );

        this._info_label = new St.Label({
            text: '<span color="black"><i>Type to search...</i></span>'
        });
        this._info_label.clutter_text.set_use_markup(true);

        this._close_button = this._get_close_button();

        this._table = new St.Table({
            homogeneous: false
        });
        this._table.add(this._title, {
            row: 0,
            col: 0
        });
        this._table.add(this._close_button, {
            row: 0,
            col: 1,
            x_fill: false,
            x_align: St.Align.END
        });
        this._table.add(this._scroll, {
            row: 1,
            col: 0,
            col_span: 2,
            y_fill: false,
            y_align: St.Align.START
        });
        this._table.add(this._search_entry, {
            row: 2,
            col: 0,
            col_span: 2,
            y_fill: false,
            x_fill: false,
            y_align: St.Align.END,
            x_align: St.Align.END
        });
        this._table.add(this._info_label, {
            row: 2,
            col: 0,
            col_span: 2,
            y_fill: false,
            x_fill: false,
            y_align: St.Align.END,
            x_align: St.Align.END
        });

        this.set_languages(languages);

        this.contentLayout.add_actor(this._table);
    },

    _on_key_press_event: function(object, event) {
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Escape) {
            this.close();
        }
        else {
            let ch = Utils.get_unichar(symbol);

            if(ch) {
                // log(ch);
                this._info_label.hide();
                this._search_entry.set_text(ch);
                this._search_entry.show();
                this._search_entry.grab_key_focus();
            }
        }
    },

    _update_list: function() {
        this._languages_table.destroy_all_children();
        let filtered = {};

        for(let key in this._languages) {
            let lang_name = this._languages[key];
            let lang_code = key;
            let search_text = this._search_entry.get_text().toLowerCase();

            if(!Utils.starts_with(lang_name.toLowerCase(), search_text)) continue;

            filtered[lang_code] = lang_name;
        }

        this.show_languages('', filtered);
    },

    _get_close_button: function() {
        let icon = new St.Icon({
            icon_name: Utils.ICONS.close,
            icon_size: 20,
            style: 'color: grey;'
        });

        let button = new St.Button({
            reactive: true
        });
        button.connect('clicked', Lang.bind(this, function() {
            this.close();
        }));
        button.add_actor(icon);

        return button;
    },

    _get_button: function(lang_code, lang_name) {
        let button = new St.Button({
            label: '%s'.format(lang_name),
            track_hover: true,
            reactive: true,
            style_class: 'translator-language-chooser-button'
        });
        button.connect('clicked', Lang.bind(this, function() {
            this.emit('language-chose', {
                code: lang_code,
                name: lang_name
            });
        }));
        button.lang_code = lang_code;
        button.lang_name = lang_name;

        return button;
    },

    _resize: function() {
        let width_percents = Utils.SETTINGS.get_int(PrefsKeys.WIDTH_PERCENTS_KEY);
        let height_percents = Utils.SETTINGS.get_int(PrefsKeys.HEIGHT_PERCENTS_KEY);
        let primary = Main.layoutManager.primaryMonitor;

        let translator_width = Math.round(primary.width / 100 * width_percents);
        let translator_height = Math.round(primary.height / 100 * height_percents);

        let chooser_width = Math.round(translator_width * 0.9);
        let chooser_height = Math.round(translator_height * 0.9);
        this._dialogLayout.set_width(chooser_width);
        this._dialogLayout.set_height(chooser_height);

        let scroll_width = Math.round(chooser_width * 0.9);
        let scroll_height = Math.round(
            chooser_height
            - this._title.height
            - this._info_label.height
            - this._dialogLayout.get_theme_node().get_padding(St.Side.BOTTOM) * 3
        );
        this._scroll.set_width(scroll_width);
        this._scroll.set_height(scroll_height);
    },

    show_languages: function(selected_language_code, list) {
        let row = 0;
        let column = 0;
        let languages = this._languages;

        if(!Utils.is_blank(list)) languages = list;

        let keys = Object.keys(languages);
        keys.sort(Lang.bind(this, function(a, b) {
            if(a === 'auto') return false;
            a = languages[a];
            b = languages[b];
            return a > b;
        }));

        for each(let code in keys) {
            let button = this._get_button(code, languages[code]);

            if(button.lang_code === selected_language_code) {
                button.add_style_pseudo_class('active');
                button.set_reactive(false);
            }

            this._languages_table.add(button, {
                row: row,
                col: column,
                x_fill: false,
                x_align: St.Align.START
            });

            if(column === (COLUMNS - 1)) {
                column = 0;
                row++
            }
            else {
                column++;
            }
        }
    },

    set_languages: function(languages) {
        if(!languages) return;
        this._languages = languages;
    },

    close: function() {
        this._languages_table.destroy_all_children();
        this._search_entry.set_text('');
        this._search_entry.hide();
        this.parent();
    },

    open: function() {
        this._resize()
        this.parent()
    },
});
Signals.addSignalMethods(LanguageChooser.prototype);
