const St = imports.gi.St;
const Lang = imports.lang;
 
const Extension = imports.misc.extensionUtils.get_text_translator_extension();
const TranslationProviderBase = Extension.imports.translation_provider_base;
const Utils = Extension.imports.utils;
 
const NAME = 'Google.Translate';
const URL =
    //'https://translate.google.com/translate_a/single?client=j&ie=UTF-8&oe=UTF-8&sl=%s&tl=%s&q=%s';
    "https://translate.google.pl/translate_a/single?client=t&sl=%s&tl=%s&hl=pl&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t&dt=at&ie=UTF-8&oe=UTF-8&otf=1&ssel=0&tsel=0&tk=519262|835597&q=%s";
const LIMIT = 1400;
const MAX_QUERIES = 3;
 
const SENTENCES_REGEXP = /\n|([^\r\n.!?]+([.!?]+|\n|$))/gim;
 
const DictionaryEntry = new Lang.Class({
    Name: "DictionaryEntry",
 
    _init: function(word, reverse_translations) {
        this.word = word;
        this.reverse_translations = reverse_translations || [];
 
        this.actor = new St.Table({
            homogeneous: false
        });
 
        this.word_label = new St.Label();
        this.word_label.clutter_text.set_markup(
            "<span font-size='small'>   %s        </span>".format(this.word)
        );
 
        let reverse_markup =
            "<span font-size='small' font-style='italic' " +
            "color='#C4C4C4'>%s</span>".format(
                this.reverse_translations.join(", ")
            );
        this.reverse_translations_label = new St.Label();
        this.reverse_translations_label.clutter_text.set_markup(reverse_markup);
 
        this.actor.add(this.word_label, {
            row: 0,
            col: 0,
            x_align: St.Align.START,
            y_align: St.Align.START,
            x_fill: false,
            x_expand: false,
            y_fill: false,
            y_expand: false
        });
        this.actor.add(this.reverse_translations_label, {
            row: 0,
            col: 1,
            x_align: St.Align.START,
            y_align: St.Align.START,
            x_fill: false,
            x_expand: false,
            y_fill: false,
            y_expand: false
        });
    },
});
 
const DictionaryPOS = new Lang.Class({
    Name: "DictionaryPOS",
 
    _init: function(pos, word) {
        this.actor = new St.Table({
            homogeneous: false
        });
 
        let markup =
            "<span font-weight='bold' font-size='medium'>%s</span>".format(word) +
            " - <span font-size='medium' font-style='italic' " +
            "color='#C4C4C4'>%s</span>".format(pos);
        this._pos_label = new St.Label();
        this._pos_label.clutter_text.set_markup(markup);
 
        this.actor.add(this._pos_label, {
            row: 0,
            col: 0,
            y_expand: false,
            x_expand: false,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });
    },
 
    add_entry: function(dictionary_entry) {
        this.actor.add(dictionary_entry.actor, {
            row: this.actor.row_count,
            col: 0,
            x_fill: false,
            x_expand: false,
            y_fill: false,
            y_expand: false,
            y_align: St.Align.START,
            x_align: St.Align.START
        });
    },
});
 
const Dictionary = new Lang.Class({
    Name: "Dictionary",
 
    _init: function(word, dict_data) {
        this._word = word;
        this._data = dict_data;
 
        this._box = new St.BoxLayout({
            vertical: true
        });
        this._scroll = new St.ScrollView({
            style: "background-color: rgba(0, 0, 0, 0.7); padding: 3px;",
            overlay_scrollbars: true,
        });
        this._scroll.add_actor(this._box);
        this.actor = new St.BoxLayout({
            opacity: 0
        });
        this.actor.add_actor(this._scroll);
 
        // this._markup_dict(this._data);
        this._show_terms(this._word, this._data);
    },
 
    _show_terms: function(word, dict_data) {
        for(let i = 0; i < dict_data.length; i++) {
            let pos = dict_data[i][0];//.pos;
            let terms = dict_data[i][1];//.terms;
            let entry = dict_data[i][2];//.entry;
 
            if(Utils.is_blank(pos)) continue;
 
            let dictionary_pos = new DictionaryPOS(pos, word);
 
            for(let k = 0; k < entry.length; k++) {
                let dictionary_entry = new DictionaryEntry(
                    entry[k][0],//.word
                    entry[k][1]//.reverse_translation
                )
                dictionary_pos.add_entry(dictionary_entry);
            }
 
            this._box.add(dictionary_pos.actor, {
                expand: true
            });
        }
    },
 
    show: function() {
        const Tweener = imports.ui.tweener;
        this.actor.opacity = 0;
 
        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            opacity: 255,
            time: 0.3,
            transition: 'easeOutQuad'
        });
    },
 
    hide: function(destroy) {
        const Tweener = imports.ui.tweener;
        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            opacity: 0,
            time: 0.3,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                if(destroy) this.destroy();
            })
        });
    },
 
    set_size: function(width, height) {
        this._scroll.width = width;
        this._scroll.height = height;
    },
 
    destroy: function() {
        this.actor.destroy();
        this._data = null;
    }
});
 
const Translator = new Lang.Class({
    Name: 'GoogleTranslate',
    Extends: TranslationProviderBase.TranslationProviderBase,
 
    _init: function(extension_object) {
        this.parent(NAME, LIMIT*MAX_QUERIES, URL);
        this._results = [];
        this._extension_object = extension_object;
    },
 
    _show_dict: function(word, json_data) {
        this._hide_dict();
 
        this._dict = new Dictionary(word, json_data);
        this._dict.set_size(
            this._extension_object._dialog.target.actor.width,
            this._extension_object._dialog.target.actor.height * 0.85
        );
        this._extension_object._dialog._table.add(this._dict.actor, {
            row: 2,
            col: 1,
            x_fill: false,
            y_fill: false,
            y_align: St.Align.END,
            x_align: St.Align.MIDDLE
        });
        this._dict.show();
    },
 
    _hide_dict: function() {
        if(this._dict) {
            this._dict.hide(true);
        }
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
    let test,test2,test3;
        try {
        test=response_data;
        test2=test;
        let reps=[['[,','[null,'],[',,',',null,'],[',]',',null]']];
        for(let i = 0; i<reps.length;i++)
        {
        test='';
        while(test!=test2)
        {
            test=test2;
            test2=test.replace(reps[i][0],reps[i][1]);
        }
        }
            json = JSON.parse(test);
        }
        catch(e) {
            log('%s Error: %s'.format(
                this.name,
                JSON.stringify(e, null, '\t')+"\nResponse_data:\n"+response_data
            ));
            return {
                error: true,
                message: JSON.stringify(e, null, '\t')+" "+response_data
            };
        }
        try
        {
           
            if(json.dict != undefined) {
                //this._show_dict(json.sentences[0].orig, json.dict);
                this._show_dict(json[0][0][0], json[1]);
            }
            else {
                this._hide_dict();
            }
     
            for(let i = 0; i < json[0].length; i++) {
                if (json[0][i][0] == null) continue;
                result += json[0][i][0];
            }
        }
        catch (e)
        {
            return "wyjatek: "+JSON.stringify(e,null,"\t");
        }
        result = Utils.escape_html(result);
        
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