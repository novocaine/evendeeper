// parser for html documents sourced from the web.
// sticks the documents in a hidden iframe in the specified
// page with images/js etc disabled for security.

EvenDeeper.HtmlParser = function(page) {
  const STATE_START = Components.interfaces.nsIWebProgressListener.STATE_START;  
  const STATE_STOP = Components.interfaces.nsIWebProgressListener.STATE_STOP;  
  
  var _page = page;
  var _iframe = null;
  var _callback = null;
  
  function createIframe() {    
    // find the iframe stuck in our overlay.xul for this purpose
    _iframe = document.getElementById("evendeeper-iframe");
    
    _iframe.setAttribute("type", "content");
    _iframe.setAttribute("collapsed", "true");
          
    _iframe.webNavigation.allowAuth = false;
    _iframe.webNavigation.allowImages = false;
    _iframe.webNavigation.allowJavascript = false;
    _iframe.webNavigation.allowMetaRedirects = false;
    _iframe.webNavigation.allowPlugins = false;
    _iframe.webNavigation.allowSubframes = false;

    _iframe.addEventListener("load", onIframeLoaded, true); 
  };
  
  function onIframeLoaded(event) {
		var iFrameDoc = event.originalTarget;
	  // skip blank page or frame
   	if (iFrameDoc.location.href == "about:blank" || iFrameDoc.defaultView.frameElement) return;
   	_callback(iFrameDoc);
  }
  
  function iframe() {
    if (_iframe == null) {
      createIframe();
    }
    
    return _iframe;
  }
  
  _this = {
    // loads the specified url, callback is invoked with the document
    loadUrl: function(url, callback) {      
      _callback = callback;
      
      // ideally we could just load this straight into the iframe; but it doesn't seem to be
      // possible to get error events from iframes so instead we get it via ajax and load it as a data uri.
      jQuery.ajax({
        url: url,
        dataType: "text",
        success: function(data) {          
          iframe().webNavigation.loadURI("data:text/html;" + encodeURI(data), Components.interfaces.nsIWebNavigation, null, null, null);
        },
        error: function(xhr, status) {
          EvenDeeper.debug("error (" + status + ") getting " + url );
          _callback(null); 
        }
      });
    }
  };
  
  return _this;
};