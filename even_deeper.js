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
      // then return its textContent in turn (thus stripping the tags)      
      var div = evendeeper.doc.createElement("div");
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
    displayResults: function(articles) {            
      var sidebarWindow = document.getElementById("sidebar").contentWindow;
            
      // Verify that our sidebar is open at this moment:
      if (sidebarWindow.location.href ==
            "chrome://evendeeper/content/sidebar.xul") {
        // call "yourNotificationFunction" in the sidebar's context:
        sidebarWindow.EvenDeeperSidebar.displayArticles(articles);
      }
    },
    
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
    displayResults: function(articles) {
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
    },
    
    createArticleFromCurrentPage: function() {
      var body = $("#article-wrapper p").text();
      var title = $("#article-header h1").text();        
      return new EvenDeeper.Article("The Guardian", title, body);
    }         
  };
};

EvenDeeper.GoogleReader = function() {
  var googleLogin = {};
  var _articles = [];
  var _grLabel = 'foreign%20policy';
  var _grItemsPerGet = 20;
  var _grMaxTotalItems = 20;
  var _grItemCount = 0;
  var _loginEmail = null;
  var _loginPassword = null;
  
  function grLogin(callback) {    
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);
    
    _loginEmail = prefs.getCharPref("extensions.evendeeper.login");
    _loginPassword = prefs.getCharPref("extensions.evendeeper.password");
    
    if (_loginEmail === null || _loginPassword === null) {
      alert("Couldn't find login details in user prefs");
      return;
    }  
    
    jQuery.post("https://www.google.com/accounts/ClientLogin",
      'accountType=HOSTED_OR_GOOGLE&service=reader&Email= ' + _loginEmail + '&Passwd=' + _loginPassword + '&source=' + EvenDeeper.userAgent,
      function(data) {                        
        googleLogin['SID'] = data.match(/SID=(.*)/)[0];        
        EvenDeeper.debug("logged into Google Reader with sid " + googleLogin['SID']);        
        callback();
      }
    );
  };
  
  function grGetItemsXHR(continuation) {
    var url = 'http://www.google.com/reader/atom/user/-/label/' + _grLabel + "?n=" + _grItemsPerGet;
    if (continuation) {
      url += "&c=" + continuation;
    }
    
    EvenDeeper.debug("getting items from " + url + " with sid " + googleLogin['SID']);
        
    jQuery.ajax({
      url: url,
      beforeSend: function(xhr) {
        xhr.setRequestHeader('Cookie', googleLogin['SID'] + ';');
      },
      success: grGetItemsCallback
    });
  };
  
  function processReaderItems(xml_response) {      
    // add all documents in response to corpus
    xml_response.find("entry").each(function() {                    
      // create and store article
      var article = EvenDeeper.ArticleFactory.createArticleFromAtom(new EvenDeeper.AtomEntry($(this)));
            
      if (_articles.length < _grMaxTotalItems) {
        _articles.push(article);      
        return true;
      } else {
        return false;
      }
    });    
            
    // make feeds
    // xml_response.find("feed")
  };
    
  function grGetItems() {
    // we can't process all the items at once as that uses a lot of memory and firefox shits itself,
    // so we process the items in batches of 20 at a time, using the continuation parameter to 
    // continually request sets.        
    grGetItemsXHR(null);
  };
  
  function grGetItemsCallback(data) {    
    // convert responseText into a dom tree we can parse
    var xml_response = $(data);
    
    // verify response
    if (xml_response.children()[0].tagName != "feed") {
      EvenDeeper.errorMsg("Google Reader responded with something indecipherable.");
      return;
    }
    
    // EvenDeeper.debug(xml_response.children());
    
    // getting the continuation is a pain in the ass because jquery doesn't support namespaces (apparently)
    var continuation_tags = xml_response.children().children().filter(function() { return this.tagName == "gr:continuation"; });
    
    if (continuation_tags.length != 0) {
      var continuation = continuation_tags[0].textContent;
      
      processReaderItems(xml_response);
    
      _grItemCount += _grItemsPerGet;
              
      if (_grItemCount < _grMaxTotalItems) {
        grGetItemsXHR(continuation);
      } else {
        _grGotAllItemsCallback();
      }
    } else {
      processReaderItems(xml_response);
      _grGotAllItemsCallback();
    }
  };
    
  return {
    loadItems: function(callback) {
      _grGotAllItemsCallback = callback;      
      grLogin(function() { grGetItems(); });
    },
    
    articles: function(articles) { return _articles; },
    
    initLogin: function(reader_login, reader_password) {    
      _loginEmail = reader_login;
      _loginPassword = reader_password;
    }
  };
}();

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
}();

EvenDeeper.Main = function() {
  var _currentDoc = null;
  var _currentArticle = null;
  var _max_nlp_considered_chars = 1000;
  var _useWorkerThread = true;
  
  function nlpDocFromArticle(article) {
    // we truncate the document because usually the key bits of the article are at the top
    // and this reduces the bias towards large documents
    //return new NLP.Document(article.body().substring(0, _max_nlp_considered_chars));
    return new NLP.Document(article.body());
  }
  
  function updatedArticleBodies(articles) {            
    EvenDeeper.debug("done updating");
    
    jQuery.each(articles, function() {
      // create document from article and add to corpus; stash doc in article
      this.nlpdoc = nlpDocFromArticle(this);
      NLP.Corpus.addDocument(this.nlpdoc);
      
    });    
    
    if (_useWorkerThread) {
      // spawn a thread and process the articles
      EvenDeeper.backgroundThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
      EvenDeeper.mainThreadInstance = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
      EvenDeeper.backgroundThreadInstance.dispatch(new workingThread(1, _currentDoc, articles), EvenDeeper.backgroundThreadInstance.DISPATCH_NORMAL);
    } else {
      EvenDeeper.ArticleSimilarity.findArticleSimilarities(_currentDoc, articles);
      EvenDeeper.Main.finishedCalculatingSimilarities();
    }
    
    /*NLP.Debug.dumpUnionTerms();
    NLP.Debug.dumpDocumentTfIdf(_currentDoc);*/
    
    // EvenDeeper.debug("starting similarity testing");
                      
  } 
    
  function grGotAllItems() { 
    EvenDeeper.debug("got items");    
    var articles = EvenDeeper.GoogleReader.articles();
    // update bodies from articles sources
    EvenDeeper.ArticleBodyUpdater.updateArticles(articles, updatedArticleBodies);
  }
          
  return {
    init: function(doc) { 
      EvenDeeper.debug(doc.location.href);
      
      if (doc.location.href.match(/guardian.co.uk/) && $("#article-wrapper").length > 0) {
        EvenDeeper.CurrentPage = new EvenDeeper.PageTypes.Guardian();
        EvenDeeper.debug("initialized as guardian");
      } else if (doc.location.href.match(/deckardsoftware.com/)) {
        EvenDeeper.CurrentPage = new EvenDeeper.PageTypes.TestHarness();    
        EvenDeeper.debug("initialized as harness");
      } else {
        return;
      }
                      
      // make an article from the current article
      _currentArticle = EvenDeeper.CurrentPage.createArticleFromCurrentPage();      
      _currentDoc = nlpDocFromArticle(_currentArticle);
      NLP.Corpus.addDocument(_currentDoc);    
      
      // get new articles from google reader
      EvenDeeper.GoogleReader.loadItems(grGotAllItems);
    }, 
    
    finishedCalculatingSimilarities: function() {
      // show results on current page
      EvenDeeper.CurrentPage.displayResults(EvenDeeper.GoogleReader.articles());      
    }  
  };
}();

EvenDeeper.ArticleSimilarity = function() {
  return { 
    findArticleSimilarities: function(currentDoc, articles) {
      //dump("starting similarity testing");
      
      var start = new Date().getTime();
      
      // compare reader-sourced articles to current article, stashing similarity in the article object
      jQuery.each(articles, function(index, article) {        
        article.similarityToCurrentArticle = NLP.Corpus.docSimilarity(currentDoc, article.nlpdoc);
      });                

      articles.sort(function(article_a, article_b) {
        return (article_b.similarityToCurrentArticle - article_a.similarityToCurrentArticle);
      });
      
      var end = new Date().getTime();
      
      dump("similarity time: " + (end - start));
    }
  };
}();

// ff3 specific threading stuff yanked from https://developer.mozilla.org/en/The_Thread_Manager

var mainThread = function(threadID, result) {
  this.threadID = threadID;
  this.result = result;
};

mainThread.prototype = {
  run: function() {
    try {
      EvenDeeper.Main.finishedCalculatingSimilarities();
    } catch(err) {
      Components.utils.reportError(err);
    }
  },
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

var workingThread = function(threadID, currentDoc, articles) {
  this.threadID = threadID;
  this.result = 0;
  this.articles = articles;
  this.currentDoc = currentDoc;
};

workingThread.prototype = {
  run: function() {
    try {
      // This is where the working thread does its processing work.
      EvenDeeper.ArticleSimilarity.findArticleSimilarities(this.currentDoc, this.articles);
      
      // When it's done, call back to the main thread to let it know
      // we're finished.
      
      EvenDeeper.mainThreadInstance.dispatch(new mainThread(this.threadID, this.result),
        EvenDeeper.backgroundThreadInstance.DISPATCH_NORMAL);
    } catch(err) {
      Components.utils.reportError(err);
    }
  },
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

/*(function() {
  EvenDeeper.Main.init();
}());*/
