EvenDeeper.Article = function(page, source, title, body_div, url) {
  var _title = title;
  var _url = url;
  var _source = source;
  var _updatedBodyCallback = null;
  var _enableUpdatingFromSource = true;
  var _updatedFromSource = false;
  var _bodyDiv = body_div;
  
  var _this = {
    title: function() { return _title; },
    body: function() { return _this.bodyDiv().textContent; },
    bodyDiv: function() { return _bodyDiv; },
    url: function() { return _url; },
    source: function() { return _source; },

    // given an article with an insigificant body, visits its url to get the full article   
    updateBodyFromSourceIfNecessary: function(page, callback) {
      if (_this.body().length < 1000 && _enableUpdatingFromSource && !_updatedFromSource) {

        EvenDeeper.debug("updating body of " + url);    
        
        page.htmlParser().loadUrl(url, function(doc) {
          // doc === null means there was some problem loading the page
          if (doc) {
            page.jQueryFn("p", doc).each(function(index, n) {                                  
              var node = page.jQueryFn(n);
            
              if (node.parent().children("p").text().length > 500) {
                // create a div with the ps in it
                _bodyDiv = page.contextDoc().createElement("div");
                
                node.parent().children("p").each(function(index, n) {
                  _bodyDiv.appendChild(n);
                });
                
                //_bodyDiv = n.parentNode;
            
                EvenDeeper.debug(n.parentNode);
                // EvenDeeper.debug("updated body to -------> " + _this.body());
                return false;
              }
            });
          
            // set this flag to avoid this being called again in the future
            _updatedFromSource = true;
          }
          
          callback();
        });
        
      } else {        
        // body too big or source yanking disabled
        callback();
      }
    }
  };
  
  return _this;
};

// utility class for calling article update in a loop for all articles
EvenDeeper.ArticleBodyUpdater = function() {
  var _index = 0;
  var _articles;
  var _doneCallback;
  var _page;

  function updatedBodyCallback() {
    ++_index;
    
    if (_index < _articles.length) {
      _articles[_index].updateBodyFromSourceIfNecessary(_page, updatedBodyCallback); 
    } else {
      _doneCallback(_articles);
    }
  };
    
  return {
    updateArticles: function(page, articles, doneCallback) {            
      if (articles.length > 0) {
        _articles = articles;
        _doneCallback = doneCallback;
        _page = page;
        _articles[0].updateBodyFromSourceIfNecessary(_page, updatedBodyCallback); 
      } else {
        doneCallback(articles);
      }
    }
  };
};

EvenDeeper.ArticleStore = function() {
  var _page = null;
  var _doneCallback = null;
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
  
  function createArticleFromAtom(atom) {
    var title = atom.elem("title");
    var body_div = atom.elem("content") || atom.elem("summary");

    if (body_div === null) {
      body_div = title;
    }
  
    return new EvenDeeper.Article(_page, atom.feed_title(), title.textContent, body_div, atom.url());
  };
    
  // google reader announced it has new items; newItems is a flag indicating whether anything's changed
  function grGotAllItems(newItems) { 
    EvenDeeper.debug("got items"); 
    
    // only do the article thing if the reader items are new; otherwise 
    // they should already be in the corpus
    if (newItems) {
      // create articles from atoms      
      var atoms = _googleReader.atoms();      
      // remember which ones are new
      var newArticles = [];
      
      jQuery.each(atoms, function(i, atom) {
        if (!hasArticle(atom.url)) {
          var article = createArticleFromAtom(atoms[i]);
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
    updateArticles: function(page, finishedCallback) {
      _page = page;
      _doneCallback = finishedCallback;
      // get new articles from google reader
      _googleReader = new EvenDeeper.GoogleReader(page);
      _googleReader.loadItems(grGotAllItems);      
    },
    
    pastExpiry: function() { return EvenDeeper.GoogleReader.Cache.expired(); },
    
    articles: function() { return _articles; },
    
    nlpDocFromArticle: function(article) {
      // we truncate the document because usually the key bits of the article are at the top
      // and this reduces the bias towards large documents
      //return new NLP.Document(article.body().substring(0, _max_nlp_considered_chars));
      return new NLP.Document(EvenDeeper.corpusInstance, article.body(), article.url());
    }    
  };
}();