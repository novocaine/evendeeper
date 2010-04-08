EvenDeeperUI.OverlayController = function() {  
  var _controllers = {};
  var _nextControllerId = 0;
  var _main = null;
  
  // startup and rego
  function onWindowLoad(e) {    
    dump("onWindowLoad\n");
                
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("evendeeper-strings");    
    gBrowser.tabContainer.addEventListener("TabOpen", onTabAdd, false);
    gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);
        
    for (var i=0; i < gBrowser.browsers.length; ++i) {
      initController(gBrowser.browsers[i]);
    }
  };  
    
  function onMenuItemCommand(e) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
  };
    
  function onTabAdd(e) {
    dump("tabAdd\n");
    var browser = gBrowser.getBrowserForTab(e.target);
    initController(browser);
  };
  
  function initController(browser) {    
    if (!browser.hasAttribute("EvenDeeper.ControllerIndex")) {
      dump("making new controller with index " + _nextControllerId + "\n");
      // add new controller for initial window if there is one
      var controller = new EvenDeeperUI.BrowserController(_nextControllerId, browser);
      browser.setAttribute("EvenDeeper.ControllerIndex", _nextControllerId);      
      _controllers[_nextControllerId++] = controller;
    } else {
      dump("not making new controller\n");
    }
  };
  
  function onTabSelect(e) {
    var browser = gBrowser.getBrowserForTab(e.target);
    var index = browser.getAttribute("EvenDeeper.ControllerIndex");
    
    if (index) {
      dump("selecting controller " + index);
      
      var controller = _controllers[index];
      controller.onTabSelect(e);
    }
  }
  
  function selectedBrowserController() {
    for (var index in _controllers) {
      if (_controllers.hasOwnProperty(index)) {
        var controller = _controllers[index];
        dump(controller);
        if (controller.isSelectedTab()) {
          return controller;
        }
      }
    }
    
    return null;    
  }
  
  window.addEventListener("load", onWindowLoad, false);  
  
  return {
    onSidebarLoaded: function() {
      var selected = selectedBrowserController();
      if (selected) selected.onSidebarLoad();
    }
  };  
}();

EvenDeeperUI.getSidebar = function() {
  var sidebarWindow = document.getElementById("sidebar").contentWindow;
  
  if (sidebarWindow.location.href == "chrome://evendeeper/content/sidebar.xul" && sidebarWindow.EvenDeeperSidebar) {
    return sidebarWindow.EvenDeeperSidebar;
  } else {
    return null;
  }
};

EvenDeeperUI.BrowserController = function(id, browser) {
  var _page = null;  
  var _state = EvenDeeperUI.PageStates.STATE_NO_PAGE;
  var _id = id;
  var _browser = browser;
  
  function setState(state) { _state = state; };  
  function getState() { return _state; };
  
  function onFinishedCalculatingSimilarities(page) {
    // have to check whether its still the same page
    // as we create a new page instance each time the dom is reloaded;
    // this could be an old page finishing
    if (page === _page) {
      setState(EvenDeeperUI.PageStates.STATE_LOADED);
      updateSidebar();
    } else {
      dump("ignoring onFinishedCalculatingSimilarities, unloaded");
    }
  };
  
  function onStartedCalculatingSimilarities(page) {
    if (page === _page) {
      setState(EvenDeeperUI.PageStates.STATE_LOADING_ARTICLES);
      updateSidebar();
    }
  };
  
  function onWontProcessThisPage(page) {
    if (page === _page) {
      setState(EvenDeeperUI.PageStates.STATE_WONT_LOAD_THIS_PAGE);
      updateSidebar();
    }
  };
  
  function updateSidebar() {
    var sb = EvenDeeperUI.getSidebar();
    if (sb && _this.isSelectedTab()) {
      sb.updateUI(getState(), _page);
    } else {
      dump("ignoring updateSidebar\n");
    }
  };
  
  function onDOMContentLoaded(e) {            
    dump("onDOMContentLoaded");
    
    // dont trigger for iframes
    if (e.originalTarget instanceof HTMLDocument) {
      var win = e.originalTarget.defaultView;
      if (win.frameElement) {
        return;
      }
    }
        
    initEvenDeeperPage(e.originalTarget);
  };
  
  function initEvenDeeperPage(doc) {
    // conjure up context for EvenDeeper.Main; basically we pass it
    // a doc handle and some callbacks    
    var context = { 
      doc: doc,
      onFinishedCalculatingSimilarities: onFinishedCalculatingSimilarities,
      onStartedCalculatingSimilarities: onStartedCalculatingSimilarities,
      onWontProcessThisPage: onWontProcessThisPage
    };
            
    dump("making new EvenDeeper.Page() in controller " + _id + "\n");
    
    browser.addEventListener("unload", onUnload, true);
    
    _page = new EvenDeeper.Page(context);
    _page.process(context);
  }
  
  function onPageShow(e) {
    // dont trigger for iframes
    if (e.originalTarget instanceof HTMLDocument) {
      var win = e.originalTarget.defaultView;
      if (win.frameElement) {
        return;
      }
    }
    
    // we handle pageshow because loads of pages from cache (e.g. when going back)
    // doesn't actually trigger a domloaded event; 
    if (e.persisted) {
      initEvenDeeperPage(e.originalTarget);
    }
  }
  
  function onUnload(e) {
    if (e.originalTarget instanceof HTMLDocument) {
      var win = e.originalTarget.defaultView;
      if (win.frameElement) {
        return;
      }
    }
    
    dump("unload on page " + _id + "\n");
    _page.setUnloaded();
  }
    
  browser.addEventListener("DOMContentLoaded", onDOMContentLoaded, true);  
  browser.addEventListener("pageshow", onPageShow, true);
  updateSidebar();
      
  var _this = {
    isSelectedTab: function() {
      return (_browser === gBrowser.selectedBrowser);
    },
    
    onSidebarLoad: function() {
      updateSidebar();
    },
    
    onTabSelect: function() {    
      dump("tabSelect\n");
      updateSidebar();    
    }    
  };
  
  return _this;
};