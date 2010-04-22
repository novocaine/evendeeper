// secret sauce to get jquery working
var EvenDeeper = {};

EvenDeeper.userAgent = 'EvenDeeper_0.1';
EvenDeeper.debugging_enabled = true;

EvenDeeper.debug = function(msg) { 
  if (EvenDeeper.debugging_enabled) {
    //dump(msg + "\n");
    Firebug.Console.log(msg);
  }
};

EvenDeeper.errorMsg = function(msg) {
  alert("EvenDeeper: " + msg);
};

// singleton processor; only allows one process at a time for simplicity - the internals aren't threadsafe
// or even asynchronously safe in the sense of running multiple pages at the same time.

EvenDeeper.PageProcessor = function() {
  var _busy = false;  
  var _currentDoc = null;
  var _this = null;
  var _currentPage = null;
  var _pageQueue = [];
  
  function enQueuePage(page) {
    _pageQueue.push(page);
  }
  
  function deQueuePage() {
    if (_pageQueue.length == 0) return null;
    return _pageQueue.shift();
  }
  
  function finishProcessing(sortedArticles) {    
    if (sortedArticles) {
      _currentPage.onProcessingDone(sortedArticles);
    }
    
    _busy = false;    
    _currentPage = null;
    
    // process next page in queue
    var page = deQueuePage();
    if (page) {
      _this.process(page);
    }
  }
      
  function similarityProcessingFinished(sortedArticles) {                
    dump("**** similarityProcessingFinished\n\n");
    for (var i=0; i < sortedArticles.length; ++i) {
      dump(sortedArticles[i].article.title() + "\t" + sortedArticles[i].article.url() + "\t" + sortedArticles[i].similarity + "\n");
      dump(sortedArticles[i].article.body() + "\n");
    }
        
    finishProcessing(sortedArticles);
  };
  
  function startProcessing() {    
    var article = _currentPage.pageArticle();
    
    if (!article)
      throw "page doesn't have article";
    
    _currentDoc = EvenDeeper.corpusInstance.getDocument(article.url());

    if (!_currentDoc) {        
      // we don't, make one. note we add it directly to the corpus, not
      // to the article store - which is reserved for articles from our backing rss feeds.
      _currentDoc = EvenDeeper.ArticleStore.nlpDocFromArticle(article);
      EvenDeeper.corpusInstance.addDocument(_currentDoc);    
    }     

    _similarity = new EvenDeeper.Similarity(_currentDoc, EvenDeeper.ArticleStore.articles(), EvenDeeper.corpusInstance);
    _similarity.run(similarityProcessingFinished);  
  };
  
  _this = {
    isBusy: function() { return _busy; },
    
    process: function(page) {
      if (_busy) {
        enQueuePage(page);        
        return;
      }
      
      _busy = true;
      _currentPage = page;
      
      if (_currentPage.isUnloaded()) {
        EvenDeeper.debug("dropping page, unloaded");
        finishProcessing(null);
        return;
      }
            
      if (EvenDeeper.ArticleStore.pastExpiry()) {
        EvenDeeper.ArticleStore.updateArticles(page, startProcessing);
        return;
      }
      
      startProcessing();                    
    }    
  };
  
  return _this;
}();

EvenDeeper.Page = function(context) {
  var _currentDoc = context.currentDoc;
  var _contextDoc = context.doc;
  var _currentPageType = null;
  var _scores = null;
  var _this = null;  
  var _htmlParser = null;
  var _unloaded = false;
  var _article = null;
  
  var _onFinishedCalculatingSimilarities = context.onFinishedCalculatingSimilarities;
  var _onStartedCalculatingSimilarities = context.onStartedCalculatingSimilarities;
  var _onWontProcessThisPage = context.onWontProcessThisPage;
  
  _this = {
    htmlParser: function() {
      if (!_htmlParser) {
        _htmlParser = new EvenDeeper.HtmlParser(_this);
      }
      
      return _htmlParser;
    },
    
    parseFragment: function(html) {
      // we use the recommended approach from mdc to safely parse the content
      // in a temporary div. the html is evaluated in the context of whatever
      // page we're currently processing (rather than the chrome context)
      // and the div is never actually inserted in the page.
      var div = _this.contextDoc().createElement("div");

      div.appendChild(Components.classes["@mozilla.org/feed-unescapehtml;1"]
          .getService(Components.interfaces.nsIScriptableUnescapeHTML)
          .parseFragment(html, false, null, div));      

      return(div);
    },
    
    // secret sauce to get jQuery working using the correct doc. use this instead of $.
    jQueryFn: function(selector, context) {
      return new jQuery.fn.init(selector, context || _contextDoc);
    },
    
    // takes a context object which contains
    //
    // .doc, a pointer to the actual document object for the page to operate on
    // .onFinishedCalculatingSimilarities, a callback that will be called with EvenDeeper.Article objects when done
    // .onStartedCalculatingSimilarities, a callback that will be called with no arguments only if we start
    process: function() {        
      // init for the correct page type
      for (var pageType in EvenDeeper.PageTypes) {
        if (EvenDeeper.PageTypes.hasOwnProperty(pageType)) {
          if (EvenDeeper.PageTypes[pageType].matchDoc(_contextDoc)) {
            
            _article = EvenDeeper.PageTypes[pageType].createArticleFromCurrentPage(_this);
            
            if (_article) {
              EvenDeeper.debug("initialized as " + pageType);
              _currentPageType = EvenDeeper.PageTypes[pageType];
            } else {
              EvenDeeper.debug("couldn't scrape data for " + pageType);
            }
          }
        }
      }
      
      if (_currentPageType === null) {      
        _onWontProcessThisPage(_this);
        return;
      }
      
      // notify delegate of our progress; basically this is confirmation that yeah, we're going to try processing this page
      _onStartedCalculatingSimilarities(_this);
                
      // go do the number crunching
      EvenDeeper.PageProcessor.process(_this);
    },          
    
    pageArticle: function() { return _article; },
    scores: function() { return _scores; },
    currentDoc: function() { return _currentDoc; },
    mainThreadInstance: function() { return _mainThreadInstance; },
    contextDoc: function() { return _contextDoc; },
    pageType: function() { return _currentPageType; },
    
    onProcessingDone: function(scores) {
      _scores = scores;
      _onFinishedCalculatingSimilarities(_this);    
    },
    
    setUnloaded: function() { _unloaded = true; },
    isUnloaded: function() { return _unloaded; }
  };
  
  return _this;
};

EvenDeeper.PageTypes = {  
  /*"Guardian" : {
    createArticleFromCurrentPage: function(page) {
      var body = page.contextDoc().getElementById("article-wrapper");
      var title = page.jQueryFn("#article-header h1").text();            
      return new EvenDeeper.Article(page, "The Guardian", title, body, page.contextDoc().location.href);
    },
    
    matchDoc: function(doc) {
      return doc.location.href.match(/guardian.co.uk/) && doc.getElementById("article-wrapper");
    }
  },*/
  
  "Generic" : {    
    createArticleFromCurrentPage: function(page) {
      var result = EvenDeeper.ArticleExtractor.findData(page.contextDoc());
      if (result.body && result.title) {
        return new EvenDeeper.Article(page, result.sourceName, result.title, result.body, page.contextDoc().location.href);
      } else {
        return null;
      }
    },
    
    matchDoc: function(doc) {      
      var regexes = {
        guardian: /guardian\.co\.uk\/.*\//
      };
            
      for (var r in regexes) {
        if (regexes.hasOwnProperty(r)) {
          if (doc.location.href.match(regexes[r])) return true;
        }
      }
      
      return false;
    }
  }
};


// singleton corpus
EvenDeeper.corpusInstance = new NLP.Corpus();