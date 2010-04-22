EvenDeeper.Article = function(page, source, title, body_div, url) {
  var _title = title;
  var _url = url;
  var _source = source;
  var _updatedBodyCallback = null;
  var _enableUpdatingFromSource = false;
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
            _bodyDiv = EvenDeeper.ArticleExtractor.findData(page, doc).body;
            // set this flag to avoid this being called again in the future
            _updatedFromSource = true;
          } else {
            EvenDeeper.debug("failed updating " + url);
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

EvenDeeper.extractArticleContent = function(page, doc) {
  
}

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

EvenDeeper.Similarity = function(_currentDoc, articles, _corpus) {  
  var _articlesArray = [];
  
  for (i in articles) {
    if (articles.hasOwnProperty(i)) {
      _articlesArray.push(articles[i]);
    }
  }    
  
  var _index = 0;
  var _scores = [];
  var _start = null;
  var _doneProcessingCallback = null;
  
  function processArticles() {
    if (_index >= _articlesArray.length) {
      return;
    }
    
    var article = _articlesArray[_index]; 
    var sim = _corpus.docSimilarity(_currentDoc, article.nlpdoc);
    
    _scores.push({ article: article, similarity: sim });
        
    ++_index;
    
    if (_index == _articlesArray.length) {
      
      _scores.sort(function(score_a, score_b) {
        return (score_b.similarity - score_a.similarity);
      });

      var end = new Date().getTime();

      dump("similarity time: " + (end - _start) + "\n\n");
      
      _doneProcessingCallback(_scores);
    } else {
      setTimeout(processArticles, 10);
    }  
  }
  
  return {
    // calculates the similarities between a set of articles and the current article.
    // returns an array of articles sorted by similarity    
    run: function(doneProcessingCallback) {
      // clear previous cached tf-idf data. this is expensive (as it means it all has to be calculated again)
      // but usually necessary because if we're at this point, it means we have no prior cached result for
      // the current page - which means the current page wasn't already part of the corpus - which means
      // it was added and all the tf-idfs need to be recalculated. there's probably a better way, but this is safe for now.
      _corpus.clearCache();    
      _start = new Date().getTime();
      _doneProcessingCallback = doneProcessingCallback;
      
      if (_articlesArray.length > 0)
        processArticles();
    }  
  };
};
