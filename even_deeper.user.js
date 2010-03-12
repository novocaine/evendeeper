// ==UserScript==
// @name           Even Deeper
// @namespace      www.deckardsoftware.com/helloworld
// @include        http://deckardsoftware.com/*
// @include        file:///Users/jsalter/Documents/dev/evendeeper/nlp_harness.html
// @require        http://code.jquery.com/jquery-1.3.2.min.js
// @require        nlp.js
// ==/UserScript==

var EvenDeeper = {};

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
  
};

EvenDeeper.Article = function(title, body) {
  var _title = title;
  var _body = body;
  
  return {
    title: function() { return _title; },
    body: function() { return _body; }
  };
};

EvenDeeper.ArticleFactory = function() {
  function scrapeGuardianBody() {
    var body = "";
    
    $("#body p").each(function() {
      body = body + $(this).text() + "\n";
    });
    
    return body;
  };
  
  return {
    createArticleFromAtom: function(atom) {            
      var atom_body = atom.elem("content") || atom.elem("summary");
      
      // need to unescape the body, which may contain html cruft.
      // trick way to do this is to stick it in a temp dom node..
      var div = document.createElement("div");      
      div.innerHTML = atom_body;
      div.innerHTML = div.textContent;
      var body = $(div).text();           
      
      var article = new EvenDeeper.Article(atom.elem("title"), body);
      return article;
    },
    
    createArticleFromCurrentPage: function() {
      var article = new EvenDeeper.Article($("#title")[0].innerHTML, scrapeGuardianBody());
      return article;
    }
    

  };
}();

EvenDeeper.Main = function() {
  var googleLogin = {};
  var _articles = [];
  
  // used for forming reader urls
  var user = "iteration";
  
  // used for google login process
  var loginEmail = 'iteration@gmail.com';
  var loginPassword = 'gong3891';
  
  function isArticlePage() {
    return (document.getElementById("article-wrapper") != null);
  };
  
  function getGoogleLogin() {
    return 'http://evendeeper.deckardsoftware.com/api/?url=' + window.location.href;
  }
  
  function errorMsg(msg) {
    alert("EvenDeeper: " + msg);
  }
  
  function grLogin() {    
    GM_xmlhttpRequest({
      method: 'POST',
      //url: 'http://www.postbin.org/14shhtt',
      url: "https://www.google.com/accounts/ClientLogin",
      headers: { 'Content-type': 'application/x-www-form-urlencoded' } ,
      data: 'accountType=HOSTED_OR_GOOGLE&service=reader&Email= ' + loginEmail + '&Passwd=' + loginPassword + '&source=EvenDeeper_0.1',      
      onload: function(response) {                
        if (response.status != 200) {
          errorMsg("couldn't log in to google reader");
          return;
        } 
                        
        googleLogin['SID'] = response.responseText.match(/SID=(.*)/)[0];
        
      }
    });
  };
  
  function grGetItemsWithLabel(label, callback) {
    GM_xmlhttpRequest({
      method: 'GET', 
      url: 'http://www.google.com/reader/atom/user/-/label/' + label,
      headers: { 'Cookie': 'SID=' + googleLogin['SID'] + ';' },
      onload: callback
    });
  }
    
  return {
    init: function() {      
      
      // make an article from the current article
      _currentArticle = EvenDeeper.ArticleFactory.createArticleFromCurrentPage();      
      var _currentDoc = new NLP.Document(_currentArticle.body());
      NLP.Corpus.addDocument(_currentDoc);
                  
      grLogin();
                  
      grGetItemsWithLabel('foreign%20policy', function(response) {
                
        // make corpus of documents from response        
        $(response.responseText).find("entry").each(function() {           
          // create and store article
          var article = EvenDeeper.ArticleFactory.createArticleFromAtom(new EvenDeeper.AtomEntry($(this)));
          _articles.push(article);
          
          // create document from article and add to corpus
          var doc = new NLP.Document(article.body());
          NLP.Corpus.addDocument(doc);                    
        });
        
        // compare reader-sourced articles to current article, stashing similarity in the article object
        $(_articles).each(function() {
          this.similarityToCurrentArticle = NLP.Corpus.docSimilarity(_currentDoc, new NLP.Document(this.body()));
        });                
        
        _articles.sort(function(article_a, article_b) {
          return (article_b.similarityToCurrentArticle - article_a.similarityToCurrentArticle);
        });      
        
        for (i in _articles) {
          console.log(_articles[i].title());
          console.log(_articles[i].similarityToCurrentArticle);
        }        
      });            
    }
  };
}();

(function() {
    EvenDeeper.Main.init();
}());


/*$(document).ready(function(){
  EvenDeeper.Main.init();
});*/


