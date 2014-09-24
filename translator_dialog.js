const St = imports.gi.St;
const Lang = imports.lang;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Params = imports.misc.params;
const Signals = imports.signals;
const ShellEntry = imports.ui.shellEntry;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const StatusBar = Me.imports.status_bar;
const CharsCounter = Me.imports.chars_counter;
const ButtonsBar = Me.imports.buttons_bar;
const LanguagesButtons = Me.imports.languages_buttons;
const PrefsKeys = Me.imports.prefs_keys;
const Utils = Me.imports.utils;
const GoogleTTS = Me.imports.google_tts;

const EntryBase = new Lang.Class({
    Name: 'EntryBase',

    _init: function(params) {
        this.params = Params.parse(params, {
            box_style: 'translator-text-box',
            entry_style: 'translator-entry'
        });

        this.scroll = new St.ScrollView({
            style_class: this.params.box_style
        });

        this.actor = new St.BoxLayout({
            reactive: true
        });
        this.actor.connect('button-press-event',
            Lang.bind(this, function() {
                this._clutter_text.grab_key_focus();
            })
        );
        this.actor.add(this.scroll, {
            x_fill: true,
            y_fill: true,
            expand: true
        });

        this._entry = new St.Entry({
            style_class: this.params.entry_style
        });
        ShellEntry.addContextMenu(this._entry);

        this._clutter_text = this._entry.get_clutter_text();
        this._clutter_text.set_single_line_mode(false);
        this._clutter_text.set_activatable(false);
        this._clutter_text.set_line_wrap(true);
        this._clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this._clutter_text.set_max_length(0);
        this._clutter_text.connect('key-press-event', Lang.bind(this, 
            this._on_key_press_event
        ));
        this.set_font_size(Utils.SETTINGS.get_int(PrefsKeys.FONT_SIZE_KEY));

        this._font_connection_id = Utils.SETTINGS.connect(
            "changed::" + PrefsKeys.FONT_SIZE_KEY,
            Lang.bind(this, function() {
                this.set_font_size(Utils.SETTINGS.get_int(PrefsKeys.FONT_SIZE_KEY));
            })
        );

        this._box = new St.BoxLayout({
            vertical: true
        });
        this._box.add(this._entry, {
            y_align: St.Align.START,
            y_fill: false
        });

        this.scroll.add_actor(this._box);
    },

    _on_key_press_event: function(o, e) {
        let symbol = e.get_key_symbol();
        let code = e.get_key_code();
        let state = e.get_state();

        let cyrillic_control = 8196;
        let cyrillic_shift = 8192;

        let control_mask =
            // state === Clutter.ModifierType.CONTROL_MASK ||
            state === cyrillic_control;
        let shift_mask =
            // state === Clutter.ModifierType.SHIFT_MASK ||
            state === cyrillic_shift;

        if(symbol == Clutter.Right) {
            let sel = this._clutter_text.get_selection_bound();

            if(sel === -1) {
               this._clutter_text.set_cursor_position(
                    this._clutter_text.text.length
                );
            }

            return false;
        }
        // cyrillic Ctrl+A
        else if(control_mask && code == 38) {
            this._clutter_text.set_selection(0, this._clutter_text.text.length);
            return true;
        }
        // cyrillic Ctrl+C
        else if(control_mask && code == 54) {
            let clipboard = St.Clipboard.get_default();
            let selection = this._clutter_text.get_selection();
            let text;

            if(!Utils.is_blank(selection)) text = selection;
            else text = this._clutter_text.text;

            clipboard.set_text(text);
            return true;
        }
        // cyrillic Ctrl+V
        else if(control_mask && code == 55) {
            let clipboard = St.Clipboard.get_default();
            clipboard.get_text(Lang.bind(this, function(clipboard, text) {
                if(!Utils.is_blank(text)) {
                    this._clutter_text.delete_selection();
                    this._clutter_text.set_text(
                        this._clutter_text.text + text
                    );
                    return true;
                }

                return false;
            }));
        }
        else if(
            (state == Clutter.ModifierType.CONTROL_MASK || state == cyrillic_control) &&
            (symbol == Clutter.Return || symbol == Clutter.KP_Enter)
        ) {
            this.emit('activate');
            return Clutter.EVENT_STOP
        }
        else {
            // let t = {
            //     state: state,
            //     symbol: symbol,
            //     code: code
            // };
            // log(JSON.stringify(t, null, '\t'));
        }

        return false;
    },

    destroy: function() {
        if(this._font_connection_id > 0) {
            Utils.SETTINGS.disconnect(this._font_connection_id);
        }

        this.actor.destroy();
    },

    grab_key_focus: function() {
        this._clutter_text.grab_key_focus();
    },

    set_size: function(width, height) {
        this.scroll.set_width(width);
        this.scroll.set_height(height);
    },

    set_font_size: function(size) {
        let style_string = "font-size: %spx".format(size);
        this.entry.set_style(style_string);
    },

    get entry() {
        return this._entry;
    },

    get clutter_text() {
        return this._clutter_text;
    },

    get text() {
        return this._entry.get_text();
    },

    set text(text) {
        this._entry.set_text(text);
    },

    set markup(markup) {
        this._clutter_text.set_markup(markup);
    },

    get length() {
        return this._entry.get_text().length;
    },

    get is_empty() {
        return this._entry.get_text().length < 1;
    },

    get max_length() {
        return this._clutter_text.get_max_length();
    },

    set max_length(length) {
        length = parseInt(length, 10);
        this._clutter_text.set_max_length(length);
        this.emit('max-length-changed');
    }
});
Signals.addSignalMethods(EntryBase.prototype);

const SourceEntry = new Lang.Class({
    Name: 'SourceEntry',
    Extends: EntryBase,

    _init: function() {
        this.parent({
            entry_style: 'translator-entry',
            box_style: 'translator-source-text-box'
        })

        let v_adjust = this.scroll.vscroll.adjustment;
        v_adjust.connect('changed', Lang.bind(this, function () {
            v_adjust.value = v_adjust.upper - v_adjust.page_size;
        }));
    },
});

const TargetEntry = new Lang.Class({
    Name: 'TargetEntry',
    Extends: EntryBase,

    _init: function() {
        this.parent({
            box_style: 'translator-target-text-box',
            entry_style: 'translator-entry'
        });

        this._clutter_text.set_editable(false);
        this.actor.connect('button-press-event', Lang.bind(this, function() {
            this._clutter_text.set_editable(true);
        }));
        this._clutter_text.connect('button-press-event',
            Lang.bind(this, function() {
                this._clutter_text.set_editable(true);
                this._clutter_text.grab_key_focus();
            })
        );
        this._clutter_text.connect('key-focus-out', Lang.bind(this, function() {
            this._clutter_text.set_editable(false);
        }));
    },
});

const ListenButton = new Lang.Class({
    Name: 'ListenButton',

    _init: function() {
        this.actor = new St.Button({
            style_class: 'listen-button'
        });
        this._icon = new St.Icon({
            icon_name: Utils.ICONS.listen,
            icon_size: 15
        });

        this.actor.add_actor(this._icon);
    },

    show: function() {
        this.actor.show();
    },

    hide: function() {
        this.actor.hide();
    },

    destroy: function() {
        this.actor.destroy();
    }
});

const TranslatorDialog = new Lang.Class({
    Name: 'TranslatorDialog',
    Extends: ModalDialog.ModalDialog,

    _init: function(text_translator) {
        this.parent({
            shellReactive: false,
            destroyOnClose: false
        });

        this._text_translator = text_translator;

        this._dialogLayout =
            typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;
        this._dialogLayout.set_style_class_name('translator-box');

        this._source = new SourceEntry();
        this._source.clutter_text.connect(
            'text-changed',
            Lang.bind(this, this._on_source_changed)
        );
        this._source.connect('max-length-changed',
            Lang.bind(this, function() {
                this._chars_counter.max_length = this._source.max_length;
            })
        );
        this._target = new TargetEntry();
        this._target.clutter_text.connect(
            'text-changed',
            Lang.bind(this, this._on_target_changed)
        );

        this._connection_ids = {
            source_scroll: 0,
            target_scroll: 0,
            sync_scroll_settings: 0,
            show_most_used: 0
        };

        this._topbar = new ButtonsBar.ButtonsBar({
            style_class: 'translator-top-bar-box'
        });
        this._dialog_menu = new ButtonsBar.ButtonsBar();
        this._statusbar = new StatusBar.StatusBar();
        this._most_used_bar = false;

        this._chars_counter = new CharsCounter.CharsCounter();

        this._google_tts = new GoogleTTS.GoogleTTS();
        this._listen_source_button = new ListenButton();
        this._listen_source_button.hide();
        this._listen_source_button.actor.connect('clicked',
            Lang.bind(this, function() {
                this.google_tts.speak(
                    this._source.text,
                    this._text_translator.current_source_lang
                )
            }))
        this._listen_target_button = new ListenButton();
        this._listen_target_button.hide();
        this._listen_target_button.actor.connect('clicked',
            Lang.bind(this, function() {
                this.google_tts.speak(
                    this._target.text,
                    this._text_translator.current_target_lang
                )
            }))

        this._table = new St.Table({
            homogeneous: false
        });
        this._table.add(this._topbar.actor, {
            row: 0,
            col: 0,
            col_span: 2
        });
        this._table.add(this._dialog_menu.actor, {
            row: 0,
            col: 1,
            expand: false,
            x_fill: false,
            y_fill: false,
            x_align: St.Align.END,
            y_align: St.Align.START
        });
        this._table.add(this._source.actor, {
            row: 2,
            col: 0,
            x_fill: false
        });
        this._table.add(this._target.actor, {
            row: 2,
            col: 1,
            x_fill: false
        });
        this._table.add(this._chars_counter.actor, {
            row: 3,
            col: 0,
            x_align: St.Align.END,
            x_fill: false
        });
        this._table.add(this._listen_source_button.actor, {
            row: 3,
            col: 0,
            x_align: St.Align.START,
            x_fill: false
        });
        this._table.add(this._listen_target_button.actor, {
            row: 3,
            col: 1,
            x_align: St.Align.START,
            x_fill: false
        });
        this._table.add(this._statusbar.actor, {
            row: 3,
            col: 1,
            x_fill: false,
            x_align: St.Align.END
        });

        this.contentLayout.add_actor(this._table);

        this._init_most_used_bar();
        this._init_scroll_sync();
    },

    _on_source_changed: function() {
        this._chars_counter.current_length = this._source.length;

        if(!this._source.is_empty) this._listen_source_button.show();
        else this._listen_source_button.hide();
    },

    _on_target_changed: function() {
        if(!this._target.is_empty) this._listen_target_button.show();
        else this._listen_target_button.hide();
    },

    _init_scroll_sync: function() {
        if(Utils.SETTINGS.get_boolean(PrefsKeys.SYNC_ENTRIES_SCROLL_KEY)) {
            this.sync_entries_scroll();
        }
        this._connection_ids.sync_scroll_settings = Utils.SETTINGS.connect(
            'changed::'+PrefsKeys.SYNC_ENTRIES_SCROLL_KEY,
            Lang.bind(this, function() {
                let sync = Utils.SETTINGS.get_boolean(
                    PrefsKeys.SYNC_ENTRIES_SCROLL_KEY
                );

                if(sync) this.sync_entries_scroll();
                else this.unsync_entries_scroll();
            })
        );
    },

    _init_most_used_bar: function() {
        if(Utils.SETTINGS.get_boolean(PrefsKeys.SHOW_MOST_USED_KEY)) {
            this._show_most_used_bar();
        }
        this._connection_ids.show_most_used = Utils.SETTINGS.connect(
            'changed::%s'.format(PrefsKeys.SHOW_MOST_USED_KEY),
            Lang.bind(this, function() {
                if(Utils.SETTINGS.get_boolean(PrefsKeys.SHOW_MOST_USED_KEY)) {
                    this._show_most_used_bar();
                }
                else {
                    this._hide_most_used_bar();
                }
            })
        );
    },

    _show_most_used_bar: function() {
        if(!this._most_used_bar) {
            this._most_used_sources = new LanguagesButtons.LanguagesButtons();
            this._most_used_targets = new LanguagesButtons.LanguagesButtons();
            this._most_used_bar = true;
        }

        this._topbar.actor.set_style("padding-bottom: 0px;");
        this._table.add(this._most_used_sources.actor, {
            row: 1,
            col: 0,
            x_fill: false,
            x_align: St.Align.START
        });
        this._table.add(this._most_used_targets.actor, {
            row: 1,
            col: 1,
            x_fill: false,
            x_align: St.Align.START
        });
    },

    _hide_most_used_bar: function() {
        if(this._most_used_bar) {
            this._topbar.actor.set_style("padding-bottom: 10px;");
            this._most_used_sources.destroy();
            this._most_used_targets.destroy();
            this._most_used_bar = false;
        }
    },

    _get_statusbar_height: function() {
        let message_id = this._statusbar.add_message('Sample message 1.');
        let result = this._statusbar.actor.get_preferred_height(-1)[1];
        this._statusbar.remove_message(message_id);
        return result;
    },

    _resize: function() {
        let width_percents = Utils.SETTINGS.get_int(
            PrefsKeys.WIDTH_PERCENTS_KEY
        );
        let height_percents = Utils.SETTINGS.get_int(
            PrefsKeys.HEIGHT_PERCENTS_KEY
        );
        let primary = Main.layoutManager.primaryMonitor;

        let box_width = Math.round(primary.width / 100 * width_percents);
        let box_height = Math.round(primary.height / 100 * height_percents);
        this._dialogLayout.set_width(box_width);
        this._dialogLayout.set_height(box_height);

        let text_box_width = Math.round(
            box_width / 2
            - this._source.entry.get_theme_node().get_padding(St.Side.LEFT) * 4
        );
        let text_box_height =
            box_height
            - this._topbar.actor.height
            - Math.max(
                this._get_statusbar_height(),
                this._chars_counter.actor.height
            );

        if(this._most_used_bar) {
            text_box_height -= Math.max(
                this._most_used_sources.actor.height,
                this._most_used_targets.actor.height
            );
        }

        this._source.set_size(text_box_width, text_box_height);
        this._target.set_size(text_box_width, text_box_height)
    },

    sync_entries_scroll: function() {
        if(this._connection_ids.source_scroll < 1) {
            let source_v_adjust = this._source.scroll.vscroll.adjustment;
            this._connection_ids.source_scroll = source_v_adjust.connect(
                'notify::value',
                Lang.bind(this, function(adjustment) {
                    let target_adjustment =
                        this._target.scroll.vscroll.adjustment;

                    if(target_adjustment.value === adjustment.value) return;
                    target_adjustment.value = adjustment.value;
                    adjustment.upper =
                        adjustment.upper > target_adjustment.upper
                        ? adjustment.upper
                        : target_adjustment.upper;
                })
            );
        }

        if(this._connection_ids.target_scroll < 1) {
            let target_v_adjust = this._target.scroll.vscroll.adjustment;
            this._connection_ids.target_scroll = target_v_adjust.connect(
                'notify::value',
                Lang.bind(this, function(adjustment) {
                    let source_adjustment =
                        this._source.scroll.vscroll.adjustment;

                    if(source_adjustment.value === adjustment.value) return;
                    source_adjustment.value = adjustment.value;

                    adjustment.upper =
                        adjustment.upper > source_adjustment.upper
                        ? adjustment.upper
                        : source_adjustment.upper;
                })
            );
        }
    },

    unsync_entries_scroll: function() {
        if(this._connection_ids.source_scroll > 0) {
            let source_v_adjust = this._source.scroll.vscroll.adjustment;
            source_v_adjust.disconnect(this._connection_ids.source_scroll);
            this._connection_ids.source_scroll = 0;
        }

        if(this._connection_ids.target_scroll > 0) {
            let target_v_adjust = this._target.scroll.vscroll.adjustment;
            target_v_adjust.disconnect(this._connection_ids.target_scroll);
            this._connection_ids.target_scroll = 0;
        }
    },

    open: function() {
        this.parent();
        this._resize();
    },

    close: function() {
        this._statusbar.clear();
        this.parent();
    },

    destroy: function() {
        if(this._connection_ids.sync_scroll_settings > 0) {
            Utils.SETTINGS.disconnect(this._connection_ids.sync_scroll_settings);
        }
        if(this._connection_ids.show_most_used > 0) {
            Utils.SETTINGS.disconnect(this._connection_ids.show_most_used);
        }

        delete this._text_translator;

        this._source.destroy();
        this._target.destroy();
        this._statusbar.destroy();
        this._dialog_menu.destroy();
        this._topbar.destroy();
        this._chars_counter.destroy();
        this._listen_source_button.destroy();
        this._listen_target_button.destroy();
        this._google_tts.destroy();
        this.parent();
    },

    get source() {
        return this._source;
    },

    get target() {
        return this._target;
    },

    get topbar() {
        return this._topbar;
    },

    get dialog_menu() {
        return this._dialog_menu;
    },

    get statusbar() {
        return this._statusbar;
    },

    get dialog_layout() {
        return this._dialogLayout;
    },

    get most_used() {
        let r = {
            sources: this._most_used_sources,
            targets: this._most_used_targets
        };
        return r;
    },

    get google_tts() {
        return this._google_tts;
    }
});
