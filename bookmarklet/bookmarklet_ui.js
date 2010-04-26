EvenDeeper.Bookmarklet = {};

EvenDeeper.Bookmarklet.UI = function() {
  var _holder = null;
  var _content = null;
  
  function createHolder() {
    // create a floating dialog
    _holder = document.createElement("div");
    _holder.id = "even-deeper_holder";
    _holder.style.top = "50px";

    var width = (document.width * 0.5);

    _holder.style.width = width + "px";
    _holder.style.left = ((document.width * 0.5) - width * 0.5) + "px";
    _holder.style.display = "none";
    
    var title = document.createElement("h1");
    title.appendChild(document.createTextNode("EvenDeeper"));
    _holder.appendChild(title);
    
    _content = document.createElement("div");
    _holder.appendChild(_content);
                
    document.body.appendChild(_holder);          
  }
  
  function clearContent() {
    _content.innerHTML = "";    
  }
  
  return {    
    init: function() {
      createHolder();
    },
      
    showLoading: function() {
      clearContent();      
      _holder.style.display = "block";
      _content.appendChild(document.createTextNode("Loading..."));
    },
    
    showResults: function(scores) {
      clearContent();
      
      var num_articles = 0;
      
      for (var i=0, len = scores.length; i < len; ++i) {        
        if (scores[i].similarity < 0.1) break;
        
        var article = scores[i].article;
        
        var source = document.createElement("span");
        source.className = "even-deeper_source";
        source.appendChild(document.createTextNode(article.source()));
                
        var link = document.createElement("a");
        link.href = article.url();
        link.appendChild(document.createTextNode(article.title()));

        var summary = document.createElement("div");      
        summary.appendChild(document.createTextNode(article.snippet()));
        summary.className = "even-deeper_summary";
                
        _content.appendChild(source);
        _content.appendChild(document.createTextNode(" - "));
        _content.appendChild(link);        
        _content.appendChild(summary);      
        
        ++num_articles;
      }
      
      if (num_articles == 0) {
        _content.innerHTML = "<p>Sorry, no relevant articles were found.</p>\
                              <p>EvenDeeper works best on news article pages.\
                              If you're at an article page already, we just couldn't find any good articles written about the topic.</p>\
                              <a href='http://evendeeper.deckardsoftware.com/tips'>Get more tips</a>";

      }
    },
    
    hide: function() {
      holder().style.display = "none";
    }
  };
}();