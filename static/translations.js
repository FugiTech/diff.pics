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
  userLanguage = userLanguage || "en";
  console.info("Loaded localized text for:", userLanguage);
  _.each(languages[userLanguage], function (template, key) {
    ich.addTemplate(key, '<span>'+template+'</span>');
  });
})({
  "en": {
    "add_comparison": "Add Comparison",
    "submit_comparison": "Submit Comparisons",
    "remove_comparison": "DELETE",

    "upload_drop": "Drop Image Here",
    "upload_or": "or",
    "upload_browse": "Browse file...",

    "uploading_search": "Finding remaining images to upload",
    "uploading_image": "Uploading {{filename}}",
    "uploading_submit": "Submitting comparison",

    "accept": "OK",
    "loading": "Loading...",
    "footer": "Submit feedback on {{{github}}} or {{{twitter}}}",
    "error": "ERROR: {{error_message}}",
  },
  "jp": {
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
