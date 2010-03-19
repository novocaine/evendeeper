// ==UserScript==
// @name           Even Deeper
// @namespace      www.deckardsoftware.com/helloworld
// @include        http://deckardsoftware.com/*
// @include        file:///Users/jsalter/Documents/dev/evendeeper/nlp_harness.html
// @require        http://code.jquery.com/jquery-1.3.2.min.js
// @require        nlp.js
// @require        login.js
// ==/UserScript==

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

EvenDeeper.AtomEntry = function(xml) {
  var _xml = $(xml);
  
  // returns the inner html of a sub-element in this article
  this.elem = function(element_name) {        
    var elements = _xml.find(element_name);
            
    if (elements.length >= 1) {
      // retreiving the text is a bit tricky; the problem is that
      // any html content in there is html-encoded (e.g. &lt; etc)
      // so that it doesn't mess with the actual atom tagging itself.
      //
      // so we need to strip that out somehow. the trick we use here is
      // to create a temp div, set its innerHTML to the text content
      // of the original element (decoding the html-encoded message),
      // then return its textContent in turn (thus stripping the tags).
      //
      // hack: break encapsulation here to get a document handle
      var div = EvenDeeperUI.Overlay.doc.createElement("div");
      div.innerHTML = elements[0].textContent;
      return(div.textContent);
    } else {
      return null;
    }
  };
    
  this.url = function() {
    var elements = _xml.find("link");
    if (elements.length >= 1) {
      return($(elements[0]).attr("href"));
    } else {
      return null;
    }
  };  
  
  this.feed_title = function() {
    var elements = _xml.find("title");
            
    // idiosyncratically, greader returns a second title element as the feed title
    if (elements.length >= 2) {
      return(elements[1].textContent);
    } else {
      return null;
    }
  };
  
  this.xml = function() { return _xml; };
};

EvenDeeper.Article = function(source, title, body, url) {
  var _title = title;
  var _body = body;
  var _url = url;
  var _source = source;
  var _updatedBodyCallback = null;
  var _enableUpdatingFromSource = false;
  
  // given an article with an insigificant body, visits its url to get the full article   
  function updateBodyFromSource() {
    EvenDeeper.debug("updating body of " + url);
    
    GM_xmlhttpRequest({
      method: 'GET', 
      url: _url,
      headers: { 
        'User-Agent': EvenDeeper.userAgent
      },        
      onload: yankPage_callback
    });
  };
  
  function yankPage_callback(response) {
    if (response.status == 200) {
      var page = $(response.responseText);
      var title = page.find("head title").text();
      var body = null;

      // generate body text 
      // strategy is to look for the first node containing > 1000 chars worth of text
      page.find("p").each(function(index, n) {      
        var node = $(n);
        if (node.parent().text().length > 500) {        
          _body = node.parent().children("p").text();        
          //EvenDeeper.debug(_body);
          return false;
        }
      });        
    } else {
      EvenDeeper.debug("got response code " + response.status + ", not updating body");
    }
    
    _updatedBodyCallback();
  };
    
  return {
    title: function() { return _title; },
    body: function() { return _body; },
    url: function() { return _url; },
    source: function() { return _source; },

    updateBodyFromSourceIfNecessary: function(callback) {      
      if (_body.length < 1000 && _enableUpdatingFromSource) {
        _updatedBodyCallback = callback;
        updateBodyFromSource();
      } else {
        callback();
      }
    }
  };
};

EvenDeeper.ArticleFactory = function() {
  return {
    createArticleFromAtom: function(atom) {
      var title = atom.elem("title");              
      var body = atom.elem("content") || atom.elem("summary");

      if (body === null) {
        body = title;
      }
      
      /*EvenDeeper.debug(title);
      EvenDeeper.debug(body);*/
            
      var article = new EvenDeeper.Article(atom.feed_title(), title, body, atom.url());
            
      return article;
    }    
  };
}();

EvenDeeper.PageTypes = {};

EvenDeeper.PageTypes.TestHarness = function() {
  return {     
    createArticleFromCurrentPage: function() {
      // presumably test harness
      var body = "";

      $("#body p").each(function() {
        body = body + $(this).text() + "\n";
      });

      return new EvenDeeper.Article("", $("#title")[0].innerHTML, body);
    }
  };
};

EvenDeeper.PageTypes.Guardian = function() {
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
      var body = $("#article-wrapper p").text();
      var title = $("#article-header h1").text();        
      return new EvenDeeper.Article("The Guardian", title, body);
    }         
  };
};


EvenDeeper.ArticleBodyUpdater = function() {
  var _index = 0;
  var _articles;
  var _doneCallback;

  function updatedBodyCallback() {
    ++_index;
    
    if (_index < _articles.length) {
      _articles[_index].updateBodyFromSourceIfNecessary(updatedBodyCallback); 
    } else {
      _doneCallback(_articles);
    }
  };
    
  return {
    updateArticles: function(articles, doneCallback) {            
      if (articles.length > 0) {
        _articles = articles;
        _doneCallback = doneCallback;
        _articles[0].updateBodyFromSourceIfNecessary(updatedBodyCallback); 
      } else {
        doneCallback(articles);
      }
    }
  };
};

EvenDeeper.Main = function() {
  var _currentDoc = null;
  var _currentArticle = null;
  var _max_nlp_considered_chars = 1000;
  var _useWorkerThread = true;
  var _googleReader = new EvenDeeper.GoogleReader();
  
  var _backgroundThreadInstance = null;
  var _mainThreadInstance = null;
  var _currentPage = null;
  var _corpus = new NLP.Corpus();
  var _this = null;
  var _onFinishedCalculatingSimilarities = null;
  var _contextDoc = null;
    
  function nlpDocFromArticle(article) {
    // we truncate the document because usually the key bits of the article are at the top
    // and this reduces the bias towards large documents
    //return new NLP.Document(article.body().substring(0, _max_nlp_considered_chars));
    return new NLP.Document(_corpus, article.body());
  }
  
  function updatedArticleBodies(articles) {                
    EvenDeeper.debug("done updating");
    
    // save articles
    _articles = articles;
    
    // populate corpus    
    jQuery.each(_articles, function(index, article) {
      // create document from article and add to corpus; stash doc in article
      article.nlpdoc = nlpDocFromArticle(article);
      _corpus.addDocument(article.nlpdoc);      
    });    
    
    if (_useWorkerThread) {
      // spawn a thread and process the articles
      _backgroundThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
      _mainThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;      
      _backgroundThreadInstance.dispatch(new workingThread(1, _this), _backgroundThreadInstance.DISPATCH_NORMAL);
    } else {
      findArticleSimilarities();
      _onFinishedCalculatingSimilarities();
    }                    
  } 
    
  function grGotAllItems() { 
    EvenDeeper.debug("got items");    
    var articles = _googleReader.articles();
    // update bodies from articles sources
    new EvenDeeper.ArticleBodyUpdater().updateArticles(articles, updatedArticleBodies);
  };
  
  _this = {
    // takes a context object which contains
    //
    // .doc, a pointer to the actual document object for the page to operate on
    // .onFinishedCalculatingSimilarities, a callback that will be called with EvenDeeper.Article objects when done
    // .onStartedCalculatingSimilarities, a callback that will be called with no arguments only if we start
    
    init: function(context) { 
      _contextDoc = context.doc;
      _onFinishedCalculatingSimilarities = context.onFinishedCalculatingSimilarities;
      
      EvenDeeper.debug(_contextDoc.location.href);
      
      // init for the correct page type
      
      if (_contextDoc.location.href.match(/guardian.co.uk/) && $("#article-wrapper").length > 0) {
        _currentPage = new EvenDeeper.PageTypes.Guardian();
        EvenDeeper.debug("initialized as guardian");
      } else if (_contextDoc.location.href.match(/deckardsoftware.com/)) {
        _currentPage = new EvenDeeper.PageTypes.TestHarness();    
        EvenDeeper.debug("initialized as harness");
      } else {
        return;
      }
      
      context.onStartedCalculatingSimilarities();
                      
      // make an article from the current article
      _currentArticle = _currentPage.createArticleFromCurrentPage();      
      _currentDoc = nlpDocFromArticle(_currentArticle);
      _corpus.addDocument(_currentDoc);    
      
      // get new articles from google reader
      _googleReader.loadItems(grGotAllItems);
    }, 
    
    findArticleSimilarities: function() {
      //dump("starting similarity testing");

      var start = new Date().getTime();

      // compare reader-sourced articles to current article, stashing similarity in the article object
      jQuery.each(_articles, function(index, article) {        
        article.similarityToCurrentArticle = _corpus.docSimilarity(_currentDoc, article.nlpdoc);
      });                

      _articles.sort(function(article_a, article_b) {
        return (article_b.similarityToCurrentArticle - article_a.similarityToCurrentArticle);
      });

      var end = new Date().getTime();

      dump("similarity time: " + (end - start));
    },
    
    articles: function() { return _articles; },
    currentDoc: function() { return _currentDoc; },
    mainThreadInstance: function() { return _mainThreadInstance; },
    backgroundThreadInstance: function() { return _backgroundThreadInstance; },
    contextDoc: function() { return _contextDoc; },
    onFinishedCalculatingSimilarities: function() { return _onFinishedCalculatingSimilarities; }
  };
  
  return _this;
};

/*(function() {
  EvenDeeper.Main.init();
}());*/
