const St = imports.gi.St;
const Lang = imports.lang;
const Params = imports.misc.params;
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const ButtonsBarButton = new Lang.Class({
    Name: 'ButtonsBarButton',

    _init: function(icon_name, text, params, action) {
        params = Params.parse(params, {
            style_class: 'translator-button',
            track_hover: true,
            reactive: true,
            toggle_mode: false,
            icon_style: 'translator-buttons-bar-icon'
        });
        this._button_box = new St.BoxLayout();

        this._sensitive = true;

        this._button = new St.Button({
            track_hover: params.track_hover,
            reactive: params.reactive,
            style_class: params.style_class,
            toggle_mode: params.toggle_mode
        });
        this._button.add_actor(this._button_box);

        if(typeof(action) == 'function') {
            this._button.connect('clicked', Lang.bind(this, function() {
                if(this._sensitive) action();
            }));
        }

        this._icon = false;
        this._label = false;

        if(!Utils.is_blank(icon_name)) {
            this._icon = new St.Icon({
                icon_name: icon_name,
                style_class: params.icon_style
            });

            this._button_box.add(this._icon, {
                x_fill: false,
                x_align: St.Align.START
            });
        }

        if(!Utils.is_blank(text)) {
            this._label = new St.Label();
            this._label.clutter_text.set_markup(text);

            this._button_box.add(this._label, {
                x_fill: false,
                y_align: St.Align.MIDDLE
            });

            if(this._icon) {
                this._label.visible = false;

                this._button.connect(
                    'enter-event',
                    Lang.bind(this, this._on_enter_event)
                );
                this._button.connect(
                    'leave-event',
                    Lang.bind(this, this._on_leave_event)
                );
            }
        }

        if(!this._icon && !this._label) {
            throw new Error('icon and label are both false');
        }
    },

    _on_enter_event: function(object, event) {
        this._label.opacity = 0;
        this._label.show();

        Tweener.addTween(this._label, {
            time: 0.3,
            opacity: 255,
            transition: 'easeOutQuad'
        });
    },

    _on_leave_event: function(object, event) {
        Tweener.addTween(this._label, {
            time: 0.3,
            opacity: 0,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                this._label.hide();
            })
        });
    },

    connect: function(signal, callback) {
        this.actor.connect(signal, callback);
    },

    set_checked: function(checked) {
        if(checked) {
            this.actor.add_style_pseudo_class('active');
        }
        else {
            this.actor.remove_style_pseudo_class('active');
        }

        this.actor.set_checked(checked);
    },

    get_checked: function() {
        return this.actor.get_checked();
    },

    set_sensitive: function(sensitive) {
        this._sensitive = sensitive;
    },

    get label_actor() {
        return this._label;
    },

    get label() {
        return this._label.clutter_text.get_text();
    },

    set label(text) {
        this._label.clutter_text.set_markup(text);
    },

    get icon_actor() {
        return this._icon;
    },

    get icon_name() {
        return this._icon.icon_name;
    },

    set icon_name(name) {
        this._icon.icon_name;
    },

    get has_icon() {
        return this._icon !== false ? true : false;
    },

    get has_label() {
        return this._label !== false ? true : false;
    },

    get actor() {
        return this._button;
    },
});

const ButtonsBarLabel = new Lang.Class({
    Name: 'ButtonsBarLabel',

    _init: function(text, style_class) {
        this._label = new St.Label({
            style_class: style_class
        });
        this._label.clutter_text.set_markup(text);

        this.actor = new St.BoxLayout();
        this.actor.add(this._label);
    },

    get label_actor() {
        return this._label;
    },

    get label() {
        return this._label.clutter_text.get_text();
    },

    set label(text) {
        this._label.clutter_text.set_markup(text);
    },
});

const ButtonsBar = new Lang.Class({
    Name: 'ButtonsBar',

    _init: function(params) {
        this.params = Params.parse(params, {
            style_class: 'translator-buttons-bar-box'
        });

        this.actor = new St.BoxLayout({
            style_class: this.params.style_class
        });
        this._buttons = [];
    },

    new_button: function(icon_name, text, params, action) {
        let button = new ButtonsBarButton(icon_name, text, params, action);
        return button;
    },

    new_label: function(text, style_class) {
        let label = new ButtonsBarLabel(text, style_class);
        return label;
    },

    add_button: function(button) {
        this._buttons.push(button);
        this.actor.add(button.actor, {
            x_fill: false,
            x_align: St.Align.START
        });
    },

    destroy: function() {
        this.actor.destroy();
    }
});
