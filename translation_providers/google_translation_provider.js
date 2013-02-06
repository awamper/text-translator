const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.get_text_translator_extension();
const TranslationProviderBase = Extension.imports.translation_provider_base;
const Utils = Extension.imports.utils;

const NAME = 'Google.Translate';
const URL =
    'http://translate.google.com/translate_a/t?' +
    'client=j&ie=UTF-8&oe=UTF-8&sl=%s&tl=%s&text=%s';
const LIMIT = 1400;
const MAX_QUERIES = 3;

const SENTENCES_REGEXP = /\n|([^\r\n.!?]+([.!?]+|\n|$))/gim;

const Translator = new Lang.Class({
    Name: 'GoogleTranslate',
    Extends: TranslationProviderBase.TranslationProviderBase,

    _init: function() {
        this.parent(NAME, LIMIT*MAX_QUERIES, URL);
        this._results = [];
    },

    _markup_dict: function(dict_data) {
        let result = '<span>';

        for(let i = 0; i < dict_data.length; i++) {
            let pos = dict_data[i].pos;
            let terms = dict_data[i].terms;
            let entry = dict_data[i].entry;

            if(!Utils.is_blank(pos)) {
                result += '<b>%s</b>\n'.format(pos);
            }

            for(let k = 0; k < entry.length; k++) {
                if(!Utils.is_blank(pos)) result += '\t';

                result += entry[k].word;

                if(entry[k].reverse_translation !== undefined) {
                    result += '\t<span color="grey">%s</span>'.format(
                        entry[k].reverse_translation.join(', ')
                    );
                }

                result += '\n';
            }
        }

        result += '</span>';
        return result;
    },

    _split_text: function(text) {
        let sentences = text.match(SENTENCES_REGEXP);

        if(sentences == null) {
            return false;
        }

        let temp = '';
        let result = [];

        for(let i = 0; i < sentences.length; i++) {
            let sentence = sentences[i];
            if(Utils.is_blank(sentence)) {
                temp += '\n';
                continue;
            }

            if(sentence.length + temp.length > LIMIT) {
                result.push(temp);
                temp = sentence;
            }
            else {
                temp += sentence;
                if(i == (sentences.length - 1)) result.push(temp);
            }
        }

        return result;
    },

    get_pairs: function(language) {
        let temp = {};

        for(let key in TranslationProviderBase.LANGUAGES_LIST) {
            if(key === 'auto') continue;

            temp[key] = TranslationProviderBase.LANGUAGES_LIST[key];
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
                JSON.stringify(e, null, '\t')+"\nResponse_data:\n"+response_data
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
            result = Utils.escape_html(result);
        }

        return result;
    },

    translate: function(source_lang, target_lang, text, callback) {
        if(Utils.is_blank(text)) {
            callback(false);
            return;
        }

        let splitted = this._split_text(text);

        if(!splitted || splitted.length === 1) {
            if(splitted) text = splitted[0];
            let url = this.make_url(source_lang, target_lang, text);
            this._get_data_async(url, Lang.bind(this, function(result) {
                let data = this.parse_response(result);
                callback(data);
            }));
        }
        else {
            this._results = [];
            Utils.asyncLoop({
                length: splitted.length,
                functionToLoop: Lang.bind(this, function(loop, i){
                    let text = splitted[i];
                    let url = this.make_url(source_lang, target_lang, text);
                    this._get_data_async(url, Lang.bind(this, function(result) {
                        let data = this.parse_response(result);
                        this._results.push(data);
                        loop();
                    }));
                }),
                callback: Lang.bind(this, function() {
                    callback(this._results.join(' '));
                })
            });
        }
    },
});
