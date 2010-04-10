EvenDeeperUI.ResultsInPage = function(_page) {
  var _scoreThreshold = 0.1;
  
  function createScoresElement() {
    var doc = _page.contextDoc();
    var scores = _page.scores();
        
    if (scores.length == 0 || scores[0].similarity < _scoreThreshold) {
      return;
    }    
    
    var holder = doc.createElement("div");
    
    // TODO: work out how to style this with a stylesheet
    holder.style.backgroundColor = "white";
    holder.style.padding = "10px 0px 10px 10px";
    holder.style.border = "solid 1px #CCCCCC";
    holder.style.fontFamily = "Helvetica,sans-serif";
    holder.style.fontSize = "10pt";
    
    holder.style.zIndex = "65535";        
    holder.style.width = "15%";
    
    var itemHolder = doc.createElement("div");
    itemHolder.style.overflowY = "auto";
    itemHolder.style.height = "200px";
    
    for (var i=0; i < scores.length && scores[i].similarity >= _scoreThreshold; ++i) {
      var scoreElement = doc.createElement("div");
      
      var sourceName = doc.createElement("div");
      sourceName.appendChild(doc.createTextNode(scores[i].article.source()));
      sourceName.style.fontWeight = "bold";  
      sourceName.style.marginBottom = "0.5em";
      scoreElement.appendChild(sourceName);
                
      var titleLink = doc.createElement("a");      
      
      titleLink.appendChild(doc.createTextNode(scores[i].article.title()));
      titleLink.setAttribute("href", scores[i].article.url());
      titleLink.setAttribute("target", "_blank");
      scoreElement.appendChild(titleLink);
      
      scoreElement.style.marginBottom = "1em";
            
      itemHolder.appendChild(scoreElement);
    }
    
    holder.appendChild(itemHolder);        
        
    doc.body.appendChild(holder);
    
    alignScoresElement(holder);
  }
  
  function alignScoresElement(holder) {
    holder.style.position = "fixed";
    holder.style.right = "0px";
    holder.style.top = "0px";
  }
  
  return {
    updateUI: function(state) {
      if (state == EvenDeeperUI.PageStates.STATE_LOADED) {      
        createScoresElement();
      }
    }
  };
};