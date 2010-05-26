EvenDeeper.Article = function(source, title, body_div, url, snippet) {
  var _title = title;
  var _url = url;
  var _source = source;
  var _updatedBodyCallback = null;
  var _updatedFromSource = false;
  var _bodyDiv = body_div;
  
  var _this = {
    title: function() { return _title; },
    body: function() { return _this.bodyDiv().textContent; },
    bodyDiv: function() { return _bodyDiv; },
    url: function() { return _url; },
    source: function() { return _source; },
    snippet: function() { return snippet; },
  };
  
  return _this;
};


