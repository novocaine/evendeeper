EvenDeeper.Article = function(main, source, title, body, url) {
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
      var page = main.jQueryFn(response.responseText);
      var title = page.find("head title").text();
      var body = null;

      // generate body text 
      // strategy is to look for the first node containing > 1000 chars worth of text
      page.find("p").each(function(index, n) {      
        var node = main.jQueryFn(n);
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

EvenDeeper.ArticleStore = function() {
  var _main = null;
  var _finishedCallback = null;
  var _googleReader = null;
  var _articles = {};
  
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
    var body = atom.elem("content") || atom.elem("summary");

    if (body === null) {
      body = title;
    }
  
    return new EvenDeeper.Article(_main, atom.feed_title(), title, body, atom.url());
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
      new EvenDeeper.ArticleBodyUpdater().updateArticles(newArticles, _finishedCallback);
    } else {
      _finishedCallback();
    }
  };
          
  return {        
    updateArticles: function(main, finishedCallback) {
      _main = main;
      _finishedCallback = finishedCallback;
      // get new articles from google reader
      _googleReader = new EvenDeeper.GoogleReader(main);
      _googleReader.loadItems(grGotAllItems);      
    },
    
    articles: function() { return _articles; }
  };
}();

