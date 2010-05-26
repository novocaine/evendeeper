// utility class for calling article update in a loop for all articles
EvenDeeper.ArticleBodyUpdater = function() {
  var _index = 0;
  var _articles;
  var _doneCallback;
  var _page;
  var _enableUpdatingFromSource = false;//true;

  function updatedBodyCallback() {
    ++_index;
    
    if (_index < _articles.length) {
      updateBodyFromSourceIfNecessary(_articles[_index], page, updatedBodyCallback); 
    } else {
      _doneCallback(_articles);
    }
  };
	
	updateBodyFromSourceIfNecessary: function(article, page, callback) {
		if (article.body().length < 1000 && _enableUpdatingFromSource && !_updatedFromSource) {

			EvenDeeper.debug("updating body of " + article.url());
			
			page.htmlParser().loadUrl(article.url(), function(doc) {
				// doc === null means there was some problem loading the page
				if (doc) {
					_bodyDiv = EvenDeeper.ArticleExtractor.findData(page, doc).body;
					// set this flag to avoid this being called again in the future
					_updatedFromSource = true;
				} else {
					EvenDeeper.debug("failed updating " + article.url());
				}
				
				callback();
			});
			
		} else {        
			// body too big or source yanking disabled
			callback();
		}
	}

  return {
    updateArticles: function(page, articles, doneCallback) {            
      if (articles.length > 0 && _enableUpdatingFromSource) {
        _articles = articles;
        _doneCallback = doneCallback;
        _page = page;
        updateBodyFromSourceIfNecessary(_articles[0], _page, updatedBodyCallback); 
      } else {
        doneCallback(articles);
      }
    }
  };
};
