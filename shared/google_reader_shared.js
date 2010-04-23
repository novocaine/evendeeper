EvenDeeper.GoogleReaderShared = {};

EvenDeeper.GoogleReaderShared.Item = function(json_item) {
  return {
    url: function() { return json_item.alternate && json_item.alternate.href; },
    body: function() { return json_item.summary; },
    title: function() { return json_item.title; },
    source: function() { return json_item.origin && json_item.origin.title; }
  };
};

EvenDeeper.GoogleReaderShared.ArticleLoader = function(page) {
  var _masterUrl = "http://www.google.com/reader/public/javascript/user/16459205132604924828/label/foreign%20policy";
  var _numArticles = 500;
  var _page = page;
  var _userCallback = null;
  var _items = [];
  var _json = null;
  
  function articlesLoadedCallback(json) { 
    _json = json;       
    var items = json.items;
    
    for (var i=0, len = items.length; i < len; ++i) {
      _items.push(new EvenDeeper.GoogleReaderShared.Item(items[i]));
    }
        
    _userCallback(_this, true);
  }
  
  function loadedItems() {
    return _items;
  }
  
  var _this = {
    loadFeeds: function(callback) {
      _userCallback = callback;
      EvenDeeper.GoogleReaderShared.articlesLoaded = articlesLoadedCallback;
      
      var doc = _page.contextDoc();
      // use jsonp to instantiate a hash of articles in the global namespace
      var script = doc.createElement("script");
      script.type = "text/javascript";
      script.src = _masterUrl + "?n=" + _numArticles + "&o=r&ot=" + EvenDeeper.dateDaysAgo(3) + "&callback=EvenDeeper.GoogleReaderShared.articlesLoaded";
      doc.getElementsByTagName("head")[0].appendChild(script);
    },
    
    createArticleFromItem: function(item) {
      var bodyDiv = _page.contextDoc().createElement("div");
      bodyDiv.appendChild(_page.contextDoc().createTextNode(item.body()));      
      return new EvenDeeper.Article(_page, item.source(), item.title(), bodyDiv, item.url());
    },
    
    loadedItems: function() { return _items; }
  };
  
  return _this;
};