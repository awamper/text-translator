const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const ModalDialog = imports.ui.modalDialog;

const HelpDialog = new Lang.Class({
    Name: 'HelpDialog',
    Extends: ModalDialog.ModalDialog,

    _init: function() {
        this.parent();

        this._dialogLayout = 
            typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;
        this._dialogLayout.connect('key-press-event', Lang.bind(this,
            this._on_key_press_event
        ));
        this._dialogLayout.set_style_class_name('translator-help-box');
    },

    _on_key_press_event: function(object, event) {
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Escape) {
            this.close();
        }
    },

    close: function() {
        this.parent();
        this.destroy();
    }
});
