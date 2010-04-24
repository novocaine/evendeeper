EvenDeeper.GoogleReaderShared = {};

EvenDeeper.GoogleReaderShared.Item = function(json_item, parent) {
  return {
    url: function() { return json_item.link; },
    body: function() { return json_item.content; },
    title: function() { return json_item.title; },
    source: function() { return parent.title.match(/"(.+)"/)[1]; },
    snippet: function() { return json_item.contentSnippet; }
  };
};

EvenDeeper.GoogleReaderShared.ArticleLoader = function(page) {
  var _googleAjaxApiUrl = "http://ajax.googleapis.com/ajax/services/feed/load";
  var _masterUrl = "http://www.google.com/reader/public/atom/user%2F16459205132604924828%2Flabel%2Fforeign%20policy";
  var _numArticles = 500;
  var _page = page;
  var _userCallback = null;
  var _items = [];
  var _json = null;
  
  function articlesLoadedCallback(json) { 
    // note that what were getting back is from the google feed api at ajax.googleapis.com
    
    _json = json;       
    var items = json.responseData.feed.entries;
    
    EvenDeeper.debug(json);
    
    for (var i=0, len = items.length; i < len; ++i) {
      _items.push(new EvenDeeper.GoogleReaderShared.Item(items[i], json.responseData.feed));
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
      // use google ajax apis to return a jsonp version of the required feed url - 
      // which is an atom feed of the user's shared items
      var script = doc.createElement("script");
      script.type = "text/javascript";
      script.src = _googleAjaxApiUrl + "?v=1.0&callback=EvenDeeper.GoogleReaderShared.articlesLoaded&num=-1&q=" 
        + encodeURIComponent(_masterUrl + "?n=" + _numArticles + "&o=r&ot=" + EvenDeeper.dateDaysAgo(3));
      
      EvenDeeper.debug("getting " + script.src);
        
      doc.getElementsByTagName("head")[0].appendChild(script);
    },
    
    createArticleFromItem: function(item) {
      var bodyDiv = _page.contextDoc().createElement("div");
      bodyDiv.innerHTML = item.body();      
      return new EvenDeeper.Article(_page, item.source(), item.title(), bodyDiv, item.url(), item.snippet());
    },
    
    loadedItems: function() { return _items; }
  };
  
  return _this;
};