EvenDeeperSidebar = function() {
  var _hide_threshold = 0.1;
  var _discard_threshold = 0.05;
  var _num_hidden_articles = 0;
  var _showing_more_articles = false;
  var _more_articles = null;
  
  function isShowingMoreArticles() { return _showing_more_articles; }
  
  function updateMoreArticlesLink(showMore) {
    _showing_more_articles = showMore;
    
    _more_articles.setAttribute("value", isShowingMoreArticles() ? "Less Articles... " : "More Articles (" + _num_hidden_articles + ")...");
    
    if (isShowingMoreArticles()) {
      _more_articles.removeEventListener("click", EvenDeeperSidebar.onMoreArticles, true);
      _more_articles.addEventListener("click", EvenDeeperSidebar.onLessArticles, true);
    } else {
      _more_articles.removeEventListener("click", EvenDeeperSidebar.onLessArticles, true);
      _more_articles.addEventListener("click", EvenDeeperSidebar.onMoreArticles, true);          
    }
  };
    
  function createVbox() {
    var vbox = document.createElement("vbox");
    vbox.setAttribute("flex", "1");
    vbox.setAttribute("id", "evenDeeperVbox");
    var page = document.getElementById("evenDeeperSidebar");
    page.appendChild(vbox);
    
    return vbox;
  }
    
  return {
    clearSideBar: function() {
      var page = document.getElementById("evenDeeperSidebar");

      // remove any existing vbox
      var vbox = document.getElementById("evenDeeperVbox");      
      if (vbox) page.removeChild(vbox);
    },
    
    showLoading: function() {
      EvenDeeperSidebar.clearSideBar();
      
      var vbox = createVbox();
      
      var loading = document.createElement("label");
      loading.setAttribute("value", "Loading...");
      loading.setAttribute("class", "loading");
      vbox.appendChild(loading);
    },
    
    displayArticles: function(articles) {
      EvenDeeperSidebar.clearSideBar();                
      // re-add it
      var vbox = createVbox();
      vbox.setAttribute("style", "overflow-y: auto");

      num_hidden_articles = 0;
      
      for (var i=0; i < articles.length; ++i) {                
        var sim = articles[i].similarityToCurrentArticle; 
        
        if (sim < _discard_threshold) {
          break;
        }
                        
        var container = document.createElement("vbox");
        vbox.appendChild(container);
        
        // hide the entry if its below the hide threshold
        if (sim < _hide_threshold) {
          container.style.display = "none";
          container.setAttribute("class", "below_threshold");
          ++_num_hidden_articles;
        }
                
        var link = document.createElement("label");
        // using text nodes rather than value attr causes text to wrap
        var text = document.createTextNode(articles[i].title());
        link.appendChild(text);  
        link.setAttribute("href", articles[i].url());
        link.setAttribute("class", "text-link");
        link.style.marginBottom = "1em";        
        
        var source = document.createElement("label");
        text = document.createTextNode(articles[i].source());
        source.appendChild(text);
        source.style.fontWeight = "bold";
                
        container.appendChild(source);
        container.appendChild(link);
      }
      
      if (_num_hidden_articles > 0) {
        // more articles link      
        _more_articles = document.createElement("label");
        _more_articles.setAttribute("value", "text");
        _more_articles.id = "more-articles";
        vbox.appendChild(_more_articles);
        
        updateMoreArticlesLink(false);
      }
    },
    
    onMoreArticles: function(e) {
      var vbox = document.getElementById("evenDeeperVbox");
      var childNodes = vbox.childNodes;
      
      for (var i=0; i < childNodes.length; ++i) {
        childNodes[i].style.display = "block";
      }
      
      updateMoreArticlesLink(true);      
    },
    
    onLessArticles: function(e) {
      var vbox = document.getElementById("evenDeeperVbox");
      var childNodes = vbox.childNodes;
      
      for (var i=0; i < childNodes.length; ++i) {
        if (childNodes[i].getAttribute("class") == "below_threshold") {
          childNodes[i].style.display = "none";
        }
      }
      
      updateMoreArticlesLink(false);            
    }
  };
}();