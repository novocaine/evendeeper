EvenDeeperSidebar = function() {
  var _hide_threshold = 0.1;
  var _discard_threshold = 0.05;
  var _num_hidden_articles = 0;
  var _showing_more_articles = false;
  var _more_articles = null;
    
  // other stuff can occupy the sidebar, so this checks that we're actually visible
  function isTheActiveSidebar() {
    // var win = document.getElementById("sidebar").contentWindow;
    return (location.href == "chrome://evendeeper/content/sidebar.xul");
  }
  
  function isShowingMoreArticles() { return _showing_more_articles; }
  
  function updateMoreArticlesLink(showMore) {
    _showing_more_articles = showMore;
    
    _more_articles.setAttribute("value", isShowingMoreArticles() ? "Less Articles... " : "More Articles (" + _num_hidden_articles + ")...");
    
    if (isShowingMoreArticles()) {
      _more_articles.removeEventListener("click", onMoreArticles, true);
      _more_articles.addEventListener("click", onLessArticles, true);
    } else {
      _more_articles.removeEventListener("click", onLessArticles, true);
      _more_articles.addEventListener("click", onMoreArticles, true);          
    }
  };
    
  function createVbox() {
    var vbox = document.createElement("vbox");
    vbox.setAttribute("flex", "1");
    vbox.setAttribute("id", "evenDeeperVbox");
    var page = document.getElementById("evenDeeperSidebar");
    page.appendChild(vbox);
    
    return vbox;
  };
  
  function clearSidebar() {
    var page = document.getElementById("evenDeeperSidebar");

    // remove any existing vbox
    var vbox = document.getElementById("evenDeeperVbox");      
    if (vbox) page.removeChild(vbox);
  };
  
  function showLoading() {
    clearSidebar();
    
    var vbox = createVbox();
    
    var loading = document.createElement("label");
    loading.setAttribute("value", "Loading...");
    loading.setAttribute("class", "loading");
    vbox.appendChild(loading);
  };
  
  function displayArticles(articles) {
    clearSidebar();                
    // re-add it
    var vbox = createVbox();
    vbox.setAttribute("style", "overflow-y: auto");

    _num_hidden_articles = 0;
    
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
    
    if (articles.length === 0) {
      var no_articles_found = document.createElement("label");
      no_articles_found.setAttribute("value", "No articles found.");
      vbox.appendChild(no_articles_found);
    }
  };
  
  function onMoreArticles(e) {
    var vbox = document.getElementById("evenDeeperVbox");
    var childNodes = vbox.childNodes;
    
    for (var i=0; i < childNodes.length; ++i) {
      childNodes[i].style.display = "block";
    }
    
    updateMoreArticlesLink(true);      
  };
  
  function onLessArticles(e) {
    var vbox = document.getElementById("evenDeeperVbox");
    var childNodes = vbox.childNodes;
    
    for (var i=0; i < childNodes.length; ++i) {
      if (childNodes[i].getAttribute("class") == "below_threshold") {
        childNodes[i].style.display = "none";
      }
    }
    
    updateMoreArticlesLink(false);            
  };
        
  return {      
    // update the sidebar based on its current state
    updateUI: function(state, evendeeper) {      
      dump("updateUI " + state + "\n");
      if (!isTheActiveSidebar()) return;
      
      switch(state) {
        case EvenDeeperUI.PageStates.STATE_NO_PAGE:
          clearSidebar();
          break;
        case EvenDeeperUI.PageStates.STATE_WAITING_FOR_DOM_LOADED:
          showLoading();
          break;
        case EvenDeeperUI.PageStates.STATE_LOADING_ARTICLES:
          showLoading();
          break;
        case EvenDeeperUI.PageStates.STATE_LOADED:
          displayArticles(evendeeper.articles());
          break;
      }
    }    
  };
}();