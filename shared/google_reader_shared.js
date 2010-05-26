EvenDeeper.GoogleReaderShared = {};

EvenDeeper.GoogleReaderShared.Item = function(ajax_item, reader_item) {
  return {
    url: function() { return ajax_item.link; },
    body: function() { return ajax_item.content; },
    title: function() { return ajax_item.title; },
    source: function() { return reader_item.origin.title; },
    snippet: function() { return ajax_item.contentSnippet; }
  };
};

EvenDeeper.GoogleReaderShared.ArticleLoader = function(doc) {
  var _googleAjaxApiUrl = "http://ajax.googleapis.com/ajax/services/feed/load";
  var _publicAtomUrl = "http://www.google.com/reader/public/atom/user%2F16459205132604924828%2Flabel%2Fforeign%20policy";
  var _publicJsUrl = "http://www.google.com/reader/public/javascript/user/16459205132604924828/label/foreign%20policy";
  var _doc = doc;
  var _userCallback = null;
  var _errorCallback = null;
  var _items = [];
  var _json = null;
  var _continuations = [];
  // only request 100 at a time as that's the maximum that the feed api will return
  var _articleChunkSize = 100;
  var _daysAgo = 3;
  var _readerItems = {};
  function loadedItems() {
    return _items;
  }
  
  function loadScript(url) {
    EvenDeeper.debug("loadScript " + url);
    
    var script = doc.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    doc.getElementsByTagName("head")[0].appendChild(script);
  }
  
  function loadPublicJSONP(continuation) {
    var url = _publicJsUrl + "?n=" + _articleChunkSize + "&o=r&ot=" + EvenDeeper.dateDaysAgo(7) + "&callback=EvenDeeper.GoogleReaderShared.loadedPublicJSONP";
    if (continuation) {
      url += "&c=" + continuation;
    }
    
    loadScript(url);
  }
  
  function loadedPublicJSONPCallback(json) {
		EvenDeeper.debug("loadedPublicJSONPCallback");
    EvenDeeper.debug(json);
   
		if (!json.items) {
			EvenDeeper.debug("JSONP request failed");
			_userCallback(_this, true);
		} else {
			// stash the items in readerItems keyed by item url
			for (var i=0, len = json.items.length; i < len; ++i) {
				var item = json.items[i];
				_readerItems[item.alternate.href] = item;
			}
					
			if (json.continuation) {
				EvenDeeper.debug("got continuation " + json.continuation + " from jsonp callback");
				_continuations.push(json.continuation);
							
				loadPublicJSONP(json.continuation);
			} else {
				loadGoogleAjaxFeed();
			}
		}
  }
  
  function loadGoogleAjaxFeed(continuation) {
    EvenDeeper.debug("loading google ajax feed");
    
    // use the google ajax feed api to load the public javascript of a google reader feed; using the specified continuation 
    // param. note the cont param gets passed to the underlying google reader feed NOT the feed api call
    var url = _googleAjaxApiUrl + "?v=1.0&callback=EvenDeeper.GoogleReaderShared.loadedGoogleAjaxFeed&num=-1&q=" +
      encodeURIComponent(_publicAtomUrl + "?n=" + _articleChunkSize + "&o=r&ot=" + EvenDeeper.dateDaysAgo(7));
    
    if (continuation) {      
      url += encodeURIComponent("&c=" + continuation);
    }    
    
    loadScript(url);
  }
  
  function loadedGoogleAjaxFeed(json) {
		EvenDeeper.debug("loadedGoogleAjaxFeed");
    EvenDeeper.debug(json);
    
    if (!json.responseData) {    
			EvenDeeper.debug("couldn't find responseData in ajax JSON");
      _errorCallback(_this);
    } else { 
			// note that what were getting back is from the google feed api at ajax.googleapis.com.
			var items = json.responseData.feed.entries;

			EvenDeeper.debug("GoogleReaderShared got " + items.length + " items");

			// add all the items
			for (var i=0, len = items.length; i < len; ++i) {
				var reader_item = _readerItems[items[i].link];
				_items.push(new EvenDeeper.GoogleReaderShared.Item(items[i], reader_item));
			}

			// then call for more if there's remaining continuation data    
			if (_continuations.length > 0) {
				var c = _continuations.shift();
				loadGoogleAjaxFeed(c);
			} else {
				EvenDeeper.debug("GoogleReaderShared finished with " + _items.length + " items");
				_userCallback(_this, true);    
			}
		}
	}
  
  var _this = {
		
    loadFeeds: function(success_callback, error_callback) {
			// callback will be called back with params
			// 1: this object
			// 2: (bool) whether the feeds were actually updated or whether we pulled from a cache 
			// (for this object, always true)
      _userCallback = success_callback;
			_errorCallback = error_callback;

      EvenDeeper.GoogleReaderShared.loadedGoogleAjaxFeed = loadedGoogleAjaxFeed;
      EvenDeeper.GoogleReaderShared.loadedPublicJSONP = loadedPublicJSONPCallback;
      
      // approach is
      // 1. load the public feed at public/javascript.. etc repeatedly using the continuation params to
      // generate a list of public feed urls representing all the data
      // 2. above data doesn't have full content of the feeds so we use the ajax feeds api to
      // retrieve the atom urls of the urls previously retrieved.
      // 
      // the process requires two passes and is convoluted because:
      // a) the public feed in JSONP mode doesn't provide full content of rss stories; they're truncated after a very short snippet
      // (but they're fine in atom mode, which isn't useful here as we need JSONP to operate from within a bookmarklet)
      //
      // b) the feed apis do provide the full content but don't allow for retreival of more than 100 items or have a continuation
      // mechanism like the public feed does
      // 
      // so our approach is to use the feed apis to get the atom feed of the google reader public feed
      
      loadPublicJSONP();    
      
    },
    
    createArticleFromItem: function(item) {
      var bodyDiv = doc.createElement("div");
      bodyDiv.innerHTML = item.body();            
      return new EvenDeeper.Article(item.source(), item.title(), bodyDiv, item.url(), item.snippet());
    },
    
    loadedItems: function() { return _items; }
  };
  
  return _this;
};
