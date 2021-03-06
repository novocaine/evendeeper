// parser for html documents sourced from the web.
// sticks the documents in a hidden iframe in the specified
// page with images/js etc disabled for security.

EvenDeeper.HtmlParser = function(page) {
  const STATE_START = Components.interfaces.nsIWebProgressListener.STATE_START;  
  const STATE_STOP = Components.interfaces.nsIWebProgressListener.STATE_STOP;  
  
  var _page = page;
  var _iframe = null;
  var _callback = null;
  var _timeout = null;
  var _currentRequestId = 0;
  
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
   	
   	// avoids potential race condition as follows
   	// 1. iframeTimeout
   	// 2. iframe actually loads during iframeTimeout, posting event to queue
   	// 3. onIframeLoaded;
   	//
   	// in this case the guard below doesn't pass because iframeTimeout nulls the request-id attribute.
   	if (iframe().getAttribute("request-id") == _currentRequestId) {   	
   	  _iframe.setAttribute("request-id", null)
   	  clearTimeout(_timeout);
   	  _callback(iFrameDoc);
   	}
  }
  
  function iframe() {
    if (_iframe == null) {
      createIframe();
    }
    
    return _iframe;
  }
  
  function iframeTimeout() {
    // there's a small possibility that this could be delivered after
    // the iframe has actually successfully loaded; the timer event
    // could have been put in an event queue prior to it being disabled
    // in iframeLoaded which would still result in it being fired.
    //
    // the attribute request-id IS cleared in iFrameLoaded, however
    if (iframe().getAttribute("request-id") == _currentRequestId) {          
      iframe().webNavigation.stop(3);
      iframe().setAttribute("request-id", null);
      _callback(null);
    }
  }
  
  _this = {
    // loads the specified url, callback is invoked with the document.
    // note there's no protection against calling loadUrl while there's
    // already a load going on
    loadUrl: function(url, callback) {
      
      _callback = callback;      
      _timeout = setTimeout(iframeTimeout, 10000);
      
      ++_currentRequestId;
      
      iframe().setAttribute("request-id", _currentRequestId);
      iframe().webNavigation.loadURI(url, 0, null, null, null);
      
      
            
      // ideally we could just load this straight into the iframe; but it doesn't seem to be
      // possible to get error events from iframes so instead we get it via ajax and load it as a data uri.
      /*jQuery.ajax({
        timeout: 10000,
        url: url,
        dataType: "text",
        success: function(data) {          
          _this.loadText(data);          
        },
        error: function(xhr, status) {
          EvenDeeper.debug("error (" + status + ") getting " + url );
          _callback(null); 
        }
      });*/
    }
    
    /*loadText: function(data) {      
      dump(encodeURI(data) + "\n\n");
      iframe().webNavigation.loadURI("data:text/html;" + encodeURI(data), 0, null, null, null);
    }*/
  };
  
  return _this;
};