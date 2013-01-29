const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.get_text_translator_extension();
const TranslationProviderBase = Extension.imports.translation_provider_base;
const Utils = Extension.imports.utils;

const NAME = 'Google.Translate';
const LIMIT = 1400;
const URL =
    'http://translate.google.com/translate_a/t?' +
    'client=j&ie=UTF-8&oe=UTF-8&sl=%s&tl=%s&text=%s';
const LANGUAGES_LIST = {
    "auto": "Detect language",
    "af": "Afrikaans",
    "ar": "Arabic",
    "az": "Azerbaijani",
    "be": "Belarusian",
    "bg": "Bulgarian",
    "bn": "Bengali",
    "ca": "Catalan",
    "cs": "Czech",
    "cy": "Welsh",
    "da": "Danish",
    "de": "German",
    "el": "Greek",
    "en": "English",
    "es": "Spanish",
    "et": "Estonian",
    "eu": "Basque",
    "fa": "Persian",
    "fi": "Finnish",
    "fr": "French",
    "ga": "Irish",
    "gl": "Galician",
    "gu": "Gujarati",
    "hi": "Hindi",
    "hr": "Croatian",
    "ht": "HaitianCreole",
    "hu": "Hungarian",
    "hy": "Armenian",
    "id": "Indonesian",
    "is": "Icelandic",
    "it": "Italian",
    "iw": "Hebrew",
    "ja": "Japanese",
    "ka": "Georgian",
    "kn": "Kannada",
    "ko": "Korean",
    "la": "Latin",
    "lo": "Lao",
    "lt": "Lithuanian",
    "lv": "Latvian",
    "mk": "Macedonian",
    "ms": "Malay",
    "mt": "Maltese",
    "nl": "Dutch",
    "no": "Norwegian",
    "pl": "Polish",
    "pt": "Portuguese",
    "ro": "Romanian",
    "ru": "Russian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "sq": "Albanian",
    "sr": "Serbian",
    "sv": "Swedish",
    "sw": "Swahili",
    "ta": "Tamil",
    "te": "Telugu",
    "th": "Thai",
    "tl": "Filipino",
    "tr": "Turkish",
    "uk": "Ukrainian",
    "ur": "Urdu",
    "vi": "Vietnamese",
    "yi": "Yiddish",
    "zh-CN": "Chinese Simplified",
    "zh-TW": "Chinese Traditional"
};

const Translator = new Lang.Class({
    Name: 'GoogleTranslate',
    Extends: TranslationProviderBase.TranslationProviderBase,

    _init: function() {
        this.parent(NAME, LIMIT, URL);
    },

    _markup_dict: function(dict_data) {
        let result = '<span>';

        for(let i = 0; i < dict_data.length; i++) {
            let pos = dict_data[i].pos;
            let terms = dict_data[i].terms;
            let entry = dict_data[i].entry;

            result += '<b>%s</b>\n'.format(pos);

            for(let k = 0; k < entry.length; k++) {
                result += '\t%s\t<span color="grey">%s</span>\n'.format(
                    entry[k].word,
                    entry[k].reverse_translation.join(', ')
                );
            }
        }

        result += '</span>';
        return result;
    },

    get_languages: function() {
        return LANGUAGES_LIST;
    },

    get_language_name: function(lang_code) {
        return LANGUAGES_LIST[lang_code] || false;
    },

    get_pairs: function(language) {
        let temp = {};

        for(let key in LANGUAGES_LIST) {
            if(key === 'auto') continue;

            temp[key] = LANGUAGES_LIST[key];
        }

        return temp;
    },

    parse_response: function(response_data) {
        let json;
        let result = '';

        try {
            json = JSON.parse(response_data);
        }
        catch(e) {
            log('%s Error: %s'.format(
                this.name,
                JSON.stringify(e, null, '\t')
            ));
            return {
                error: true,
                message: "Can't translate text, please try later."
            };
        }

        if(json.dict != undefined) {
            result = this._markup_dict(json.dict);
            result = '%s\n\n%s'.format(json.sentences[0].trans, result);
        }
        else {
            for(let i = 0; i < json.sentences.length; i++) {
                result += json.sentences[i].trans;
            }
        }

        return result;
    },

    translate: function(source_lang, target_lang, text, callback) {
        if(Utils.is_blank(text)) {
            callback(false);
            return;
        }

        let url = this.make_url(source_lang, target_lang, text);
        this._get_data_async(url, Lang.bind(this, function(result) {
            let helper_data = this.parse_response(result);
            callback(helper_data);
        }));
    },
});
