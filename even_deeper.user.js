// ==UserScript==
// @name           Even Deeper
// @namespace      www.deckardsoftware.com/helloworld
// @include        http://deckardsoftware.com/*
// @include        file:///Users/jsalter/Documents/dev/evendeeper/nlp_harness.html
// @require        http://code.jquery.com/jquery-1.3.2.min.js
// @require        nlp.js
// ==/UserScript==

var EvenDeeper = {};

EvenDeeper.userAgent = 'EvenDeeper_0.1';
EvenDeeper.debugging_enabled = true;

EvenDeeper.debug = function(msg) { 
  if (EvenDeeper.debugging_enabled) {
    console.log(msg); 
  }
};

EvenDeeper.errorMsg = function(msg) {
  alert("EvenDeeper: " + msg);
};


EvenDeeper.AtomEntry = function(xml) {
  var _xml = $(xml);
  //console.log(_xml);
  
  // returns the inner html of a sub-element in this article
  this.elem = function(element_name) {
    var elements = _xml.find(element_name);
    if (elements.length >= 1) {
      return(elements[0].innerHTML);
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
      return(elements[1].innerHTML);
    } else {
      return null;
    }
  };
};

EvenDeeper.Article = function(source, title, body, url) {
  var _title = title;
  var _body = body;
  var _url = url;
  var _source = source;
  var _updatedBodyCallback = null;
  
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
    var page = $(response.responseText);
    var title = page.find("head title").text();
    var body = null;

    // generate body text 
    // strategy is to look for the first node containing > 1000 chars worth of text
    page.find("p").each(function(node) {
      var node = $(this);
      
      if (node.parent().text().length > 500) {        
        _body = node.parent().children("p").text();        
        //EvenDeeper.debug(_body);
        return false;
      }
    });        
    
    _updatedBodyCallback();
  };
    
  return {
    title: function() { return _title; },
    body: function() { return _body; },
    url: function() { return _url; },
    source: function() { return _source; },

    updateBodyFromSourceIfNecessary: function(callback) {      
      if (_body.length < 1000) {
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
      //console.log("articling " + title);
      var atom_body = atom.elem("content") || atom.elem("summary");
      
      // need to unescape the body, which may contain html cruft.
      // trick way to do this is to stick it in a temp dom node..
      var div = document.createElement("div");      
      div.innerHTML = atom_body;
      div.innerHTML = div.textContent;
      var body = $(div).text();           
      
      var article = new EvenDeeper.Article(atom.feed_title(), title, body, atom.url());
      return article;
    }    
  };
}();

EvenDeeper.PageTypes = {};

EvenDeeper.PageTypes.TestHarness = function() {
  return { 
    displayResults: function(articles) {      
      for (i in articles) {
        console.log(articles[i].title());
        console.log(articles[i].similarityToCurrentArticle);
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

if (document.location.href.match(/guardian.co.uk/) && $("#article-wrapper").length > 0) {
  EvenDeeper.CurrentPage = new EvenDeeper.PageTypes.Guardian();
  console.log("initialized as guardian");
} else {
  EvenDeeper.CurrentPage = new EvenDeeper.PageTypes.TestHarness();    
  console.log("initialized as harness");
}

EvenDeeper.GoogleReader = function() {
  var googleLogin = {};
  var _articles = [];
  var _grLabel = 'evendeeper';
  var _grItemsPerGet = 20;
  var _grMaxTotalItems = 500;
  var _grItemCount = 0;
  
  // used for forming reader urls
  var user = "iteration";
  
  // used for google login process
  var loginEmail = 'iteration@gmail.com';
  var loginPassword = 'gong3891';

  function grLogin(callback) {    
    GM_xmlhttpRequest({
      method: 'POST',
      //url: 'http://www.postbin.org/14shhtt',
      url: "https://www.google.com/accounts/ClientLogin",
      headers: { 'Content-type': 'application/x-www-form-urlencoded' } ,
      data: 'accountType=HOSTED_OR_GOOGLE&service=reader&Email= ' + loginEmail + '&Passwd=' + loginPassword + '&source=' + EvenDeeper.userAgent,      
      onload: function(response) {                
        if (response.status != 200) {
          errorMsg("couldn't log in to google reader");
          return;
        }
        
        googleLogin['SID'] = response.responseText.match(/SID=(.*)/)[0];
        
        EvenDeeper.debug("logged into Google Reader with sid " + googleLogin['SID']);
        
        callback();
      }
    });
  };
  
  function grGetItemsXHR(continuation) {
    var url = 'http://www.google.com/reader/atom/user/-/label/' + _grLabel + "?n=" + _grItemsPerGet;
    if (continuation) {
      url += "&c=" + continuation;
    }
    
    EvenDeeper.debug("getting items from " + url + " with sid " + googleLogin['SID']);
        
    GM_xmlhttpRequest({
      method: 'GET', 
      url: url,
      headers: { 
        'Accept': '*/*',
        'Cookie': googleLogin['SID'] + ';',
        'User-Agent': EvenDeeper.userAgent
      },
      onload: grGetItemsCallback
    });
  };
  
  function processReaderItems(xml_response) {      
    // add all documents in response to corpus
    xml_response.find("entry").each(function() {                               
      // create and store article
      var article = EvenDeeper.ArticleFactory.createArticleFromAtom(new EvenDeeper.AtomEntry($(this)));
      _articles.push(article);
      
      // create document from article and add to corpus
      var doc = new NLP.Document(article.body());
      NLP.Corpus.addDocument(doc);                    
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
  
  function grGetItemsCallback(response) {    
    // convert responseText into a dom tree we can parse
    var xml_response = $(response.responseText);

    // verify response
    if (xml_response[0].tagName != "FEED") {
      EvenDeeper.errorMsg("Google Reader responded with something indecipherable.");
      return;
    }
      
    // getting the continuation is a pain in the ass because jquery doesn't support namespaces (apparently)
    var continuation_tags = xml_response.children().filter(function() { return this.tagName == "GR:CONTINUATION"; });
    
    if (continuation_tags.length != 0) {
      var continuation = continuation_tags[0].innerHTML;
      
      EvenDeeper.debug(continuation);
      
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
    
    articles: function(articles) { return _articles; }
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
    
  function updatedArticleBodies(articles) {
    // compare reader-sourced articles to current article, stashing similarity in the article object
    $(articles).each(function() {
      this.similarityToCurrentArticle = NLP.Corpus.docSimilarity(_currentDoc, new NLP.Document(this.body()));
    });                
            
    articles.sort(function(article_a, article_b) {
      return (article_b.similarityToCurrentArticle - article_a.similarityToCurrentArticle);
    });      
            
    // show results on current page
    EvenDeeper.CurrentPage.displayResults(articles);
  }  
  
  function grGotAllItems() { 
    EvenDeeper.debug("got items");
    
    var articles = EvenDeeper.GoogleReader.articles();
    // update bodies from articles sources
    EvenDeeper.ArticleBodyUpdater.updateArticles(articles, updatedArticleBodies);
  }
        
  return {
    init: function() {            
      // make an article from the current article
      _currentArticle = EvenDeeper.CurrentPage.createArticleFromCurrentPage();      
      _currentDoc = new NLP.Document(_currentArticle.body());
      NLP.Corpus.addDocument(_currentDoc);    
                  
      // get new articles from google reader
      EvenDeeper.GoogleReader.loadItems(grGotAllItems);
    }
  };
}();

(function() {
    EvenDeeper.Main.init();
}());


/*$(document).ready(function(){
  EvenDeeper.Main.init();
});*/


