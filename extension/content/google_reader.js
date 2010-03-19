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
};
