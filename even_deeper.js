// secret sauce to get jquery working
var EvenDeeper = {};

EvenDeeper.userAgent = 'EvenDeeper_0.1';
EvenDeeper.debugging_enabled = true;

EvenDeeper.debug = function(msg) { 
  if (EvenDeeper.debugging_enabled) {
    //console.log(msg); 
    Firebug.Console.log(msg);
  }
};

EvenDeeper.errorMsg = function(msg) {
  alert("EvenDeeper: " + msg);
};

EvenDeeper.PageTypes = {};

EvenDeeper.PageTypes.TestHarness = function(main) {
  return {     
    createArticleFromCurrentPage: function() {
      // presumably test harness
      var body = "";

      main.jQueryFn("#body p").each(function() {
        body = body + main.jQueryFn(this).text() + "\n";
      });
      
      return new EvenDeeper.Article(main, "", main.jQueryFn("#title")[0].innerHTML, body, main.contextDoc().location.href);
    }
  };
};

EvenDeeper.PageTypes.Guardian = function(main) {
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
      var body = main.jQueryFn("#article-wrapper p").text();
      var title = main.jQueryFn("#article-header h1").text();        
      return new EvenDeeper.Article(main, "The Guardian", title, body, main.contextDoc().location.href);
    }         
  };
};

EvenDeeper.Main = function() {
  var _currentDoc = null;
  var _currentPage = null;
  
  var _max_nlp_considered_chars = 1000;
  
  var _useWorkerThread = true;    
  var _backgroundThreadInstance = null;
  var _mainThreadInstance = null;
  var _sortedSimilarArticles = null;
  
  var _this = null;
  var _onFinishedCalculatingSimilarities = null;
  var _contextDoc = null;  
  
  function corpus() {
    return EvenDeeper.Main.corpusInstance;
  }
    
  function nlpDocFromArticle(article) {
    // we truncate the document because usually the key bits of the article are at the top
    // and this reduces the bias towards large documents
    //return new NLP.Document(article.body().substring(0, _max_nlp_considered_chars));
    return new NLP.Document(corpus(), article.body(), article.url());
  };
  
  function updatedArticles() {                
    EvenDeeper.debug("done updating");

    // populate corpus    
    jQuery.each(EvenDeeper.ArticleStore.articles(), function(index, article) {
      // create document from article and add to corpus; stash doc in article
      article.nlpdoc = nlpDocFromArticle(article);
      corpus().addDocument(article.nlpdoc);      
    });

    if (_useWorkerThread) {            
      // spawn a thread to process the articles. the trick is we don't want multiple threads clobbering
      // the NLP component at once - it's not threadsafe - so we put a big dumb lock around the whole thing.
      //
      // we spin here until _backgroundThreadInstance becomes null. the spinning doesn't suffer a race
      // condition because this code can only be executed by the main thread.
                  
      var thread = Components.classes["@mozilla.org/thread-manager;1"]
                              .getService(Components.interfaces.nsIThreadManager)
                              .currentThread;
      
      // make a copy of the article array in ArticleStore to pass to the similarity tester; we don't actually
      // need to copy the articles themselves (as they are immutable after they've been put in ArticleStore)
      // but the actual contents of the array may be altered from the main thread while a worker thread is running
      var articles = [];
      
      jQuery.each(EvenDeeper.ArticleStore.articles(), function(i, article) {
        articles.push(article);
      });
      
      while (_backgroundThreadInstance) {
        thread.processNextEvent(true);
      }
      
      _backgroundThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
      _mainThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
      
      var context = {
        articles: articles,
        callback: workerThreadFinished,
        mainThreadInstance: _mainThreadInstance,
        backgroundThreadInstance: _backgroundThreadInstance,
        corpus: EvenDeeper.Main.corpusInstance,
        currentDoc: _currentDoc
      };
      
      _backgroundThreadInstance.dispatch(new workingThread(1, context), _backgroundThreadInstance.DISPATCH_NORMAL);
    } else {
      _sortedSimilarArticles = EvenDeeper.Similarity.findArticleSimilarities(_currentDoc, EvenDeeper.ArticleStore.articles(), EvenDeeper.Main.corpusInstance);
      _onFinishedCalculatingSimilarities(_this);
    }                    
  };   
  
  // called by the worker thread when its done, on the main thread.
  function workerThreadFinished(sortedArticles) {
    EvenDeeper.debug("workerThreadFinished");
    
    // setting this to null allows any other waiters to run their thread
    _backgroundThreadInstance = null;
    _sortedSimilarArticles = sortedArticles;
    _onFinishedCalculatingSimilarities(_this);
  };   
    
  _this = {
    // secret sauce to get jQuery working using the correct doc. use this instead of $.
    jQueryFn: function(selector, context) {
      return new jQuery.fn.init(selector, context || _contextDoc);
    },
    
    // takes a context object which contains
    //
    // .doc, a pointer to the actual document object for the page to operate on
    // .onFinishedCalculatingSimilarities, a callback that will be called with EvenDeeper.Article objects when done
    // .onStartedCalculatingSimilarities, a callback that will be called with no arguments only if we start
    
    init: function(context) {       
      _contextDoc = context.doc;
      _onFinishedCalculatingSimilarities = context.onFinishedCalculatingSimilarities;
      
      // init for the correct page type
      
      if (_contextDoc.location.href.match(/guardian.co.uk/) && _contextDoc.getElementById("article-wrapper")) {
        _currentPage = new EvenDeeper.PageTypes.Guardian(this);
        EvenDeeper.debug("initialized as guardian");
      } else if (_contextDoc.location.href.match(/deckardsoftware.com/)) {
        _currentPage = new EvenDeeper.PageTypes.TestHarness(this);    
        EvenDeeper.debug("initialized as harness");
      } else {
        return;
      }
      
      // notify delegates of our progress
      context.onStartedCalculatingSimilarities();
                      
      // see if we already have a document for the current page
      var article = _currentPage.createArticleFromCurrentPage();      
      _currentDoc = corpus().getDocument(article.url());
      
      if (!_currentDoc) {
        // we don't, make one
        _currentDoc = nlpDocFromArticle(article);
        corpus().addDocument(_currentDoc);    
      }
      
      EvenDeeper.ArticleStore.updateArticles(_this, updatedArticles);      
    }, 
                
    sortedSimilarArticles: function() { return _sortedSimilarArticles; },
    currentDoc: function() { return _currentDoc; },
    mainThreadInstance: function() { return _mainThreadInstance; },
    backgroundThreadInstance: function() { return _backgroundThreadInstance; },
    contextDoc: function() { return _contextDoc; }
  };
  
  return _this;
};

EvenDeeper.Similarity = {
  // calculates the similarities between a set of articles and the current article.
  // returns an array of articles sorted by similarity    
  findArticleSimilarities: function(currentDoc, articles, corpus) {
    var start = new Date().getTime();
    
    // we don't want to disturb the ordering of the original articles collection
    var sortedArticles = [];
    
    // compare reader-sourced articles to current article, stashing similarity in the article object
    jQuery.each(articles, function(index, article) {        
      article.similarityToCurrentArticle = corpus.docSimilarity(currentDoc, article.nlpdoc);
      sortedArticles.push(article);
    });                

    sortedArticles.sort(function(article_a, article_b) {
      return (article_b.similarityToCurrentArticle - article_a.similarityToCurrentArticle);
    });

    var end = new Date().getTime();

    dump("similarity time: " + (end - start));
    
    return sortedArticles;
  }
};

// singleton corpus
EvenDeeper.Main.corpusInstance = new NLP.Corpus();

/*(function() {
  EvenDeeper.Main.init();
}());*/
