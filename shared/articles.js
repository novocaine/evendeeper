EvenDeeper.ArticleStore = function() {
  var _page = null;
  var _doneCallback = null;
  var _errorCallback = null;
  var _googleReader = null;
  var _articles = {};
  var _max_nlp_considered_chars = 1000;

  function addArticle(article) {
    // dont add if we already have an article with this url
    if (hasArticle()) {
      return;
    } else {
      _articles[article.url()] = article;
    }
  }
  
  function hasArticle(url) {
    return _articles.hasOwnProperty(url);
  }
        
  // google reader announced it has new items; newItems is a flag indicating whether anything's changed
  function gotAllItems(dataSource, newItems) { 
    EvenDeeper.debug("ArticleStore.gotAllItems"); 

    // only do the article thing if the reader items are new; otherwise 
    // they should already be in the corpus
    if (newItems) {
      // create articles from atoms      
      var items = dataSource.loadedItems();      
      // remember which ones are new
      var newArticles = [];
      
      jQuery.each(items, function(i, item) {
        if (!hasArticle(item.url())) {
          var article = dataSource.createArticleFromItem(items[i]);
          // remember its new, as we're going to update its body
          newArticles.push(article);          
          // actually add it
          addArticle(article);
        }        
      });
    
      // update bodies from articles sources
      new EvenDeeper.ArticleBodyUpdater().updateArticles(_page, newArticles, onUpdatedArticles);
      
    } else {
      _doneCallback();
    }
  };
      
  function onUpdatedArticles() {
    EvenDeeper.debug("onUpdatedArticles");
    
    // populate corpus with the finalised articles. note we wait before
    // the article is definitely finalised (including the update phase)
    // before actually adding it to the corpus; so once its in the corpus its immutable.    
    jQuery.each(_articles, function(index, article) {
      // create document from article and add to corpus; stash doc in article
      article.nlpdoc = EvenDeeper.ArticleStore.nlpDocFromArticle(article);
      EvenDeeper.corpusInstance.addDocument(article.nlpdoc);
    });    
    
    _doneCallback();
  };
            
  return {        
    updateArticles: function(options) {
      _page = options.page;
      _doneCallback = options.finishedCallback;
			_errorCallback = options.errorCallback;
      
      if (options.dataSource == "GoogleReader") {
        // get new articles from google reader
        _googleReader = new EvenDeeper.GoogleReader(_page);
        _googleReader.loadItems(gotAllItems);      
      } else if (options.dataSource == "GoogleReaderShared") {        
        _googleReaderShared = new EvenDeeper.GoogleReaderShared.ArticleLoader(_page);
        _googleReaderShared.loadFeeds(gotAllItems, _errorCallback);
      } else {
        throw "Unknown datasource";
      }
    },
    
    pastExpiry: function(dataSource) { 
      if (dataSource == "GoogleReader") {
        return EvenDeeper.GoogleReader.Cache.expired();
      } else if (dataSource == "GoogleReaderShared") {
        return true;
      } else {
        throw "Unknown datasource";
      }
    },
    
    articles: function() { return _articles; },
    
    nlpDocFromArticle: function(article) {
      // we truncate the document because usually the key bits of the article are at the top
      // and this reduces the bias towards large documents
      //return new NLP.Document(article.body().substring(0, _max_nlp_considered_chars));
      return new NLP.Document(EvenDeeper.corpusInstance, article.body(), article.url());
    }    
  };
}();

