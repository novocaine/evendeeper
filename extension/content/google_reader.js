EvenDeeper.AtomEntry = function(reader, xml) {
  // we use jquery to parse the xml; that introduces a dependency on the current
  // document which is why we need to pass a reader instance to the constructor
  var _xml = reader.main().jQueryFn(xml);
  
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
      // then return its textContent in turn (thus stripping the tags).
      //
      // hack: break encapsulation here to get a document handle
      var div = reader.main().contextDoc().createElement("div");
      div.innerHTML = elements[0].textContent;
      return(div.textContent);
    } else {
      return null;
    }
  };
    
  this.url = function() {
    var elements = _xml.find("link");
    if (elements.length >= 1) {
      return(reader.main().jQueryFn(elements[0]).attr("href"));
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

EvenDeeper.GoogleReader = function(main) {
  var googleLogin = {};
  var _atoms = [];
  var _grLabel = 'foreign%20policy';
  var _grItemsPerGet = 20;
  var _grMaxTotalItems = 500;
  var _grItemCount = 0;
  var _loginEmail = null;
  var _loginPassword = null;
  var _main = main;
  
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
    xml_response.find("entry").each(function(index, entry) {
      
      
      // create and store article
      var atom = new EvenDeeper.AtomEntry(_this, _main.jQueryFn(entry));
            
      if (_atoms.length < _grMaxTotalItems) {
        _atoms.push(atom);      
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
    var xml_response = main.jQueryFn(data);
    
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
        gotAllItems();
      }
    } else {
      processReaderItems(xml_response);
      gotAllItems();      
    }
    
    function gotAllItems() {
      EvenDeeper.GoogleReader.Cache.cacheAtoms(_atoms);
      _grGotAllItemsCallback();
    }
  };
    
  var _this = { 
    main: function() { return _main; },
        
    loadItems: function(callback) {
      _grGotAllItemsCallback = callback;      
      
      // check if we have a non-expired cache copy in memory
      if (EvenDeeper.GoogleReader.Cache.expired()) {        
        grLogin(function() { grGetItems(); });
      } else {
        EvenDeeper.debug("using reader cache");
        _atoms = EvenDeeper.GoogleReader.Cache.getAtoms();
        _grGotAllItemsCallback();
      }      
    },
    
    atoms: function(articles) { return _atoms; },
    
    initLogin: function(reader_login, reader_password) {    
      _loginEmail = reader_login;
      _loginPassword = reader_password;
    }
  };
  
  return _this;
};

EvenDeeper.GoogleReader.Cache = function() {
  var _atoms = null;
  var _cache_timestamp = null;

  // one hour, in millseconds
  var _max_age = 1000*60*60;
  
  return {
    expired: function() {
      if (_atoms === null) return true;
      return ((new Date().getTime() - _cache_timestamp) > _max_age);
    },
    
    cacheAtoms: function(atoms) {
      _atoms = atoms;
      _cache_timestamp = new Date().getTime();
    },
    
    getAtoms: function() { return _atoms; }
  };
}();

// EvenDeeper.GoogleReader.Cache = function(reader) {
//   fucntion getProfileDirectory() {
//     return Components.classes["@mozilla.org/file/directory_service;1"].  
//                          getService(Components.interfaces.nsIProperties).  
//                          get("ProfD", Components.interfaces.nsIFile);
//   }
//   
//   function getCachePath() {
//     var dir = getProfileDirectory();
//     dir.append("EvenDeeper.GoogleReader.cache");
//     return dir;
//   }
//   
//   return {
//     storeAtoms: function(atoms) {
//       var cachePath = getCachePath();      
//       var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].  
//                                createInstance(Components.interfaces.nsIFileOutputStream);      
//       
//       // PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE; i.e. create if its not there and overwrite if it is      
//       // 0666 is unix file perms      
//       foStream.init(cachePath, 0x02 | 0x08 | 0x20, 0666, 0);   
//       
//       var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].  
//                                 createInstance(Components.interfaces.nsIConverterOutputStream);  
// 
//       converter.init(foStream, "UTF-8", 0, 0);  
//       
//       converter.writeString(data);  
//       converter.close();  
//     }
//     
//     getAtoms: function(atoms) {
//       
//     }
//   };
// }();