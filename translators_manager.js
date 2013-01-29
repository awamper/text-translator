const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const PrefsKeys = Me.imports.prefs_keys;
const Utils = Me.imports.utils;

const TranslatorsManager = new Lang.Class({
    Name: 'TranslatorsManager',

    _init: function() {
        this._translators = this._load_translators();
        this._default = this.get_by_name(
            Utils.SETTINGS.get_string(PrefsKeys.DEFAULT_TRANSLATOR_KEY)
        );
        this._current = this._default;
    },

    _load_translators: function() {
        let translators = [];
        let translators_imports = Me.imports.translation_providers;
        let files_list = Utils.get_files_in_dir(Me.path+'/translation_providers')

        for(let i = 0; i < files_list.length; i++) {
            let file_name = files_list[i];
            let module_name = file_name.slice(0, -3);

            if(!Utils.ends_with(file_name, '_translation_provider.js')) continue;

            let translator = new translators_imports[module_name].Translator();
            translator.file_name = file_name;
            translators.push(translator);
        }

        return translators;
    },

    get_by_name: function(name) {
        for(let i = 0; i < this._translators.length; i++) {
            let translator = this._translators[i];

            if(translator.name.toLowerCase() == name.toLowerCase()) {
                return translator;
            }
        }

        return false;
    },

    get current() {
        return this._current;
    },

    set current(name) {
        let translator = this.get_by_name(name);
        this._current = translator;
    },

    get default() {
        return this._default;
    },

    get translators_names() {
        let result = [];

        for(let i = 0; i < this._translators.length; i++) {
            result.push(this._translators[i].name);
        }

        return result;
    },

    get translators() {
        return this._translators;
    },

    get num_translators() {
        return this._translators.length;
    },
});
