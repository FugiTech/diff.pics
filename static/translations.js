var urlParams;
(window.onpopstate = function () {
  var match,
      pl     = /\+/g,  // Regex for replacing addition symbol with a space
      search = /([^&=]+)=?([^&]*)/g,
      decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
      query  = window.location.search.substring(1);

  urlParams = {};
  while (match = search.exec(query)) {
    if (!urlParams[decode(match[1])]) urlParams[decode(match[1])] = [];
    urlParams[decode(match[1])].push(decode(match[2]));
  }
})();

(function (languages) {
  var userLanguage = (urlParams["locale"] || window.navigator.languages || [window.navigator.language || window.navigator.userLanguage])[0];
  while (!languages[userLanguage] && _.contains(userLanguage, "-")) {
    userLanguage = _.initial(userLanguage.split("-")).join("-");
  }

  console.info("Loaded localized text for:", userLanguage);

  // Graceful fallback to EN if some templates aren't defined in other languages
  _.each([userLanguage, "en"], function (language) {
    if (!languages[language]) return;

    _.each(languages[language], function (template, key) {
      if (_.isUndefined(ich[key])) {
        ich.addTemplate(key, '<span>'+template.replace(/\n/g,"<br>")+'</span>');
      }
    });
  });
})({
  "en": {
    "comparison_title": "Comparison Title",
    "add_comparison": "Add Comparison",
    "rename_comparison": "Mass Rename",
    "swap_columns": "Swap Columns",
    "submit_comparison": "Submit Comparisons",
    "remove_comparison": "\nD\nE\nL\nE\nT\nE",

    "add_column": "Add Column",

    "upload_drop": "Drop Image Here",
    "upload_or": "or",
    "upload_browse": "Browse file...",

    "magic_prompt": "Dragging more than one file at a time doesn't work with the manual UI.\nHowever, we can try to figure out what images to compare automatically.\nDrop your files anywhere on the page to try it out!",
    "wizard_title": "Auto-Magic Image Comparison Calculator",

    "uploading_search": "Finding remaining images to upload",
    "uploading_image": "Uploading {{filename}}",
    "uploading_submit": "Submitting comparison",

    "accept": "OK",
    "download": "DOWNLOAD",
    "loading": "Loading...",
    "footer": "Submit feedback on {{{github}}} or {{{twitter}}}",
    "error": "ERROR: {{error_message}}",

    "duplicate_file_error": "You can't upload the same file twice",
  },
  "jp": {
    "comparison_title": "比較タイトル",
    "add_comparison": "比較を追加",
    "submit_comparison": "比較を提出",
    "remove_comparison": "消す",

    "upload_drop": "ここに画像をドロップ",
    "upload_or": "又は",
    "upload_browse": "ファイルを閲覧する...",

    "uploading_search": "残りの画像を見つけることは、アップロードする",
    "uploading_image": "アップロード {{filename}}",
    "uploading_submit": "提出比較",

    "accept": "受け入れる",
    "loading": "荷重...",
    "footer": "{{{github}}}のや{{{twitter}}}のフィードバックを送信",
    "error": "誤差: {{error_message}}",
  },
});
