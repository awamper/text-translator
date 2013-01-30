const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.get_text_translator_extension();
const TranslationProviderBase = Extension.imports.translation_provider_base;
const Utils = Extension.imports.utils;

const NAME = 'Yandex.Translate';
const LIMIT = 9800;
const URL =
    'https://translate.yandex.net/api/v1/tr.json/' +
    'translate?lang=%s-%s&text=%s';
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

const LANGUAGE_PAIRS = [
    "ru-en",
    "ru-pl",
    "ru-uk",
    "ru-de",
    "ru-fr",
    "ru-es",
    "ru-it",
    "ru-tr",
    "en-ru",
    "en-uk",
    "en-de",
    "en-fr",
    "en-es",
    "en-tr",
    "pl-ru",
    "pl-uk",
    "uk-ru",
    "uk-en",
    "uk-pl",
    "uk-de",
    "uk-fr",
    "uk-es",
    "uk-it",
    "uk-tr",
    "de-ru",
    "de-en",
    "de-uk",
    "fr-ru",
    "fr-en",
    "fr-uk",
    "es-ru",
    "es-en",
    "es-uk",
    "it-ru",
    "it-uk",
    "tr-ru",
    "tr-en",
    "tr-uk"
];

const Translator = new Lang.Class({
    Name: 'YandexTranslate',
    Extends: TranslationProviderBase.TranslationProviderBase,

    _init: function() {
        this.parent(NAME, LIMIT, URL);
    },

    get_language_name: function(lang_code) {
        return LANGUAGES_LIST[lang_code] || false;
    },

    get_languages: function() {
        let temp = {};

        for(let i = 0; i < LANGUAGE_PAIRS.length; i++) {
            let pair = LANGUAGE_PAIRS[i];
            let lang_code = pair.slice(0, 2);
            let lang_name = LANGUAGES_LIST[lang_code];

            temp[lang_code] = lang_name;
        }

        return temp;
    },

    get_pairs: function(language) {
        let temp = {};

        for(let i = 0; i < LANGUAGE_PAIRS.length; i++) {
            let pair = LANGUAGE_PAIRS[i];
            let source_lang_code = pair.slice(0, 2)
            let target_lang_code = pair.slice(-2)

            if(source_lang_code.toLowerCase() == language.toLowerCase()) {
                temp[target_lang_code] = LANGUAGES_LIST[target_lang_code];
            }
        }

        return temp;
    },

    parse_response: function(response_data) {
        let json;

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

        let result = '';

        if(json.code == 200) {
            result = json.text.join(' ');
        }
        else {
            result = {
                error: true,
                message: 'Error code: %s'.format(json.code)
            }
        }

        return result;
    },

    // translate: function(source_lang, target_lang, text, callback) {
    //     if(source_lang == 'auto') source_lang = '';
    //     this.parent(source_lang, target_lang, text, callback);
    // },
});
