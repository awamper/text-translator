const Lang = imports.lang;
const Soup = imports.gi.Soup;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;

const _httpSession = Utils._httpSession;

const TranslationProviderPrefs = new Lang.Class({
    Name: "TranslationProviderPrefs",

    _init: function(provider_name) {
        this._name = provider_name;

        this._last_source;
        this._last_target;
        this._default_source;
        this._default_target;
        this._remember_last_used;

        this._load_prefs();
    },

    _load_prefs: function() {
        let json_string = Utils.SETTINGS.get_string(
            PrefsKeys.TRANSLATORS_PREFS_KEY
        );
        let prefs = JSON.parse(json_string);

        if(prefs[this._name] === undefined) {
            throw new Error("Can't load prefs for %s".format(this._name));
            return;
        }

        prefs = prefs[this._name];
        this._default_source = prefs.default_source || "en";
        this._default_target = prefs.default_target || "ru";
        this._last_source = prefs.last_source || "";
        this._last_target = prefs.last_target || "";
        this._remember_last_used = prefs.remember_last_used || false;
    },

    save_prefs: function(new_prefs) {
        let json_string = Utils.SETTINGS.get_string(
            PrefsKeys.TRANSLATORS_PREFS_KEY
        );
        let current_prefs = JSON.parse(json_string);
        let temp = {};

        if(current_prefs[this._name] != undefined) {
            temp = current_prefs[this._name];
        }

        for(let key in new_prefs) {
            temp[key] = new_prefs[key];
        }

        current_prefs[this._name] = temp;

        Utils.SETTINGS.set_string(
            PrefsKeys.TRANSLATORS_PREFS_KEY,
            JSON.stringify(current_prefs)
        );
    },

    get last_source() {
        return !Utils.is_blank(this._last_source)
        ? this._last_source
        : false;
    },

    set last_source(lang_code) {
        this._last_source = lang_code;
        this.save_prefs({
            last_source: lang_code
        });
    },

    get last_target() {
        return !Utils.is_blank(this._last_target) ?
        this._last_target
        : false;
    },

    set last_target(lang_code) {
        this._last_target = lang_code;
        this.save_prefs({
            last_target: lang_code
        });
    },

    get default_source() {
        return this._default_source;
    },

    set default_source(lang_code) {
        this._default_source = lang_code;
        this.save_prefs({
            default_source: lang_code
        });
    },

    get default_target() {
        return this._default_target
    },

    set default_target(lang_code) {
        this._default_target = lang_code;
        this.save_prefs({
            default_target: lang_code
        });
    },

    get remember_last_used() {
        return this._remember_last_used;
    },

    set remember_last_used(enable) {
        enable = enable === true ? true : false;
        this._remember_last_used = enable;
        this.save_prefs({
            remember_last_used: enable
        });
    },
});

const TranslationProviderBase = new Lang.Class({
    Name: 'TranslationProviderBase',

    _init: function(name, limit, url) {
        this._name = name;
        this._limit = limit;
        this._url = url;
        this.prefs = new TranslationProviderPrefs(this._name);
    },

    _get_data_async: function(url, callback) {
        let request = Soup.Message.new('GET', url);

        _httpSession.queue_message(request, Lang.bind(this,
            function(_httpSession, message) {
                if(message.status_code === 200) {
                    try {
                        callback(request.response_body.data);
                    }
                    catch(e) {
                        log('Error: '+e);
                        callback('');
                    }
                }
                else {
                    callback('');
                }
            }
        ));
    },

    make_url: function(source_lang, target_lang, text) {
        let result = this._url.format(
            source_lang,
            target_lang,
            encodeURIComponent(text)
        );
        return result;
    },

    get_languages: function() {
        throw new Error('Not implemented');
    },

    get_pairs: function(language) {
        throw new Error('Not implemented');
    },

    parse_response: function(helper_source_data) {
        throw new Error('Not implemented');
    },

    translate: function(source_lang, target_lang, text, callback) {
        throw new Error('Not implemented');
    },

    get_language_name: function(code) {
        throw new Error('Not implemented');
    },

    get name() {
        return this._name;
    },

    get limit() {
        return this._limit;
    },
});
