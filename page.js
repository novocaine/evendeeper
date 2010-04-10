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

EvenDeeper.PageTypes = {};

EvenDeeper.PageTypes.TestHarness = function(page) {
  return {     
    createArticleFromCurrentPage: function() {                  
      return new EvenDeeper.Article(page, "", page.jQueryFn("#title")[0].innerHTML, page.contextDoc().getElementById("body"), page.contextDoc().documentURI);
    }
  };
};

EvenDeeper.PageTypes.Guardian = function(page) {
  return { 
    /*displayResults: function(articles) {
      var after_elem = $("#content");
      
      var html = "<div id='even_deeper'><h3>Even Deeper</h3><ul>";
      var max_articles = 10;      
      
      $(articles).each(function(i) {
        if (i >= max_articles) return false;
        var li = "<li style='font-size: 0.9em'>";
        li += ('<strong>' + this.source() + '</strong>');
        li += (": <a href='" + this.url() + "' target='_blank'>" + this.title() + "</a>");
        li += (" (" + (Math.round(this.similarityToCurrentArticle * 100) / 100) + ")");
        li += "</li>";
        html += li;
        return true;
      });
      
      html += "</ul></div>";
      
      after_elem.append(html);
    },*/
    
    createArticleFromCurrentPage: function() {
      var body = page.contextDoc().getElementById("article-wrapper");
      var title = page.jQueryFn("#article-header h1").text();            
      return new EvenDeeper.Article(page, "The Guardian", title, body, page.contextDoc().location.href);
    }         
  };
};

// singleton processor; only allows one process at a time for simplicity - the internals aren't threadsafe
// or even asynchronously safe in the sense of running multiple pages at the same time.

EvenDeeper.PageProcessor = function() {
  var _busy = false;  
  var _useWorkerThread = false;    
  var _backgroundThreadInstance = null;
  var _mainThreadInstance = null;
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
      
  // called by the worker thread when its done, on the main thread.
  function workerThreadFinished(sortedArticles) {                
    dump("**** workerThreadFinished\n\n");
    for (var i=0; i < sortedArticles.length; ++i) {
      dump(sortedArticles[i].article.title() + "\t" + sortedArticles[i].article.url() + "\t" + sortedArticles[i].similarity + "\n");
      dump(sortedArticles[i].article.body() + "\n");
    }
        
    finishProcessing(sortedArticles);
  };
  
  function startProcessing() {
    // see if we already have a document for the current page. 
    //
    // note we don't actually use the article object created here (i.e. put it in the article store), its
    // just used as a convenient object holding appropriate data
    var article = _currentPage.pageType().createArticleFromCurrentPage();      
    _currentDoc = EvenDeeper.corpusInstance.getDocument(article.url());

    if (!_currentDoc) {        
      // we don't, make one. note we add it directly to the corpus, not
      // to the article store - which is reserved for articles from our backing rss feeds.
      _currentDoc = EvenDeeper.ArticleStore.nlpDocFromArticle(article);
      EvenDeeper.corpusInstance.addDocument(_currentDoc);    
    }     

    if (_useWorkerThread) {                        
      // spawn a thread to process the articles. the trick is we don't want multiple threads clobbering
      // the NLP component at once - it's not threadsafe - so we put a big dumb lock around the whole thing.
      //                  
      // note you could also do this using web workers - but it would be inefficient as web workers' message
      // passing only supports copying in strings - copying in the entire corpus isn't an option for us
      var thread = Components.classes["@mozilla.org/thread-manager;1"]
                              .getService(Components.interfaces.nsIThreadManager)
                              .currentThread;
                              
      dump("***** starting worker thread\n\n");

      _backgroundThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
      _mainThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;

      var context = {
        articles: EvenDeeper.ArticleStore.articles(),
        callback: workerThreadFinished,
        mainThreadInstance: _mainThreadInstance,
        backgroundThreadInstance: _backgroundThreadInstance,
        corpus: EvenDeeper.corpusInstance,
        currentDoc: _currentDoc
      };

      _backgroundThreadInstance.dispatch(new workingThread(1, context), _backgroundThreadInstance.DISPATCH_NORMAL);

    } else {
      _similarity = new EvenDeeper.Similarity(_currentDoc, EvenDeeper.ArticleStore.articles(), EvenDeeper.corpusInstance);
      _similarity.run(workerThreadFinished);
    }
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
      if (_contextDoc.location.href.match(/guardian.co.uk/) && _contextDoc.getElementById("article-wrapper")) {
        _currentPageType = new EvenDeeper.PageTypes.Guardian(this);
        EvenDeeper.debug("initialized as guardian");
      } else if (_contextDoc.location.href.match(/deckardsoftware.com/)) {
        _currentPageType = new EvenDeeper.PageTypes.TestHarness(this);    
        EvenDeeper.debug("initialized as harness");
      } else {
        _onWontProcessThisPage(_this);
        return;
      }
      
      // notify delegate of our progress; basically this is confirmation that yeah, we're going to try processing this page
      _onStartedCalculatingSimilarities(_this);
                
      // go do the number crunching
      EvenDeeper.PageProcessor.process(_this);
    },          
    
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

// singleton corpus
EvenDeeper.corpusInstance = new NLP.Corpus();