const St = imports.gi.St;
const Lang = imports.lang;
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
const PrefsKeys = Me.imports.prefs_keys;
const Utils = Me.imports.utils;

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
            y_fill: true
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
        this.actor.destroy();
    },

    grab_key_focus: function() {
        this._clutter_text.grab_key_focus();
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

const TranslatorDialog = new Lang.Class({
    Name: 'TranslatorDialog',
    Extends: ModalDialog.ModalDialog,

    _init: function() {
        this.parent({
            shellReactive: false
        });

        this._dialogLayout = 
            typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;
        this._dialogLayout.set_style_class_name('translator-box');

        this._source = new SourceEntry();
        this._target = new TargetEntry();

        this._connection_ids = {
            source_scroll: 0,
            target_scroll: 0,
            sync_scroll_settings: 0
        };

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

        this._topbar = new ButtonsBar.ButtonsBar({
            style_class: 'translator-top-bar-box'
        });
        this._bottombar = new ButtonsBar.ButtonsBar();
        this._statusbar = new StatusBar.StatusBar();
        this._chars_counter = new CharsCounter.CharsCounter();

        this._source.clutter_text.connect('text-changed',
            Lang.bind(this, function() {
                this._chars_counter.current_length = this._source.length;
            })
        );
        this._source.connect('max-length-changed',
            Lang.bind(this, function() {
                this._chars_counter.max_length = this._source.max_length;
            })
        );

        let table = new St.Table({
            homogeneous: false
        });

        table.add(this._topbar.actor, {
            row: 0,
            col: 0,
            col_span: 2
        });
        table.add(this._source.actor, {
            row: 1,
            col: 0,
            x_fill: false
        });
        table.add(this._target.actor, {
            row: 1,
            col: 1,
            x_fill: false
        });
        table.add(this._chars_counter.actor, {
            row: 2,
            col: 0,
            x_align: St.Align.END,
            x_fill: false
        });
        table.add(this._bottombar.actor, {
            row: 3,
            col: 0
        });
        table.add(this._statusbar.actor, {
            row: 3,
            col: 1,
            x_fill: false,
            x_align: St.Align.END
        });

        this.contentLayout.add_actor(table);
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

    close: function() {
        this._statusbar.clear();
        this.parent();
    },

    destroy: function() {
        if(this._connection_ids.sync_scroll_settings > 0) {
            Utils.SETTINGS.disconnect(this._connection_ids.sync_scroll_settings);
        }

        this._source.destroy();
        this._target.destroy();
        this._statusbar.destroy();
        this._bottombar.destroy();
        this._topbar.destroy();
        this._chars_counter.destroy();
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

    get bottombar() {
        return this._bottombar;
    },

    get statusbar() {
        return this._statusbar;
    },

    get dialog_layout() {
        return this._dialogLayout;
    },
});
