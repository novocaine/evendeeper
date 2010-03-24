EvenDeeperUI.OverlayController = function() {  
  var _controllers = {};
  var _nextControllerId = 0;
  var _main = null;
  
  // startup and rego
  function onWindowLoad() {    
    dump("windowLoad");    
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
      var controller = new EvenDeeperUI.PageController(_nextControllerId, browser);
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
  
  window.addEventListener("load", onWindowLoad, false);
}();

EvenDeeperUI.getSidebar = function() {
  var sidebarWindow = document.getElementById("sidebar").contentWindow;
  
  if (sidebarWindow.location.href == "chrome://evendeeper/content/sidebar.xul" && sidebarWindow.EvenDeeperSidebar) {
    return sidebarWindow.EvenDeeperSidebar;
  } else {
    return null;
  }
};

EvenDeeperUI.PageController = function(id, browser) {
  var _page = null;  
  var _state = EvenDeeperUI.PageStates.STATE_NO_PAGE;
  var _id = id;
  var _browser = browser;
  
  function setState(state) { _state = state; };  
  function getState() { return _state; };
  
  function onFinishedCalculatingSimilarities(evendeeper) {
    dump("controller " + id + " got onFinishedCalculatingSimilarities");
    
    setState(EvenDeeperUI.PageStates.STATE_LOADED);
    updateSidebar();
  };
  
  function onStartedCalculatingSimilarities(evendeeper) {
    setState(EvenDeeperUI.PageStates.STATE_LOADING_ARTICLES);
    updateSidebar();
  };
  
  function isSelectedTab() {
    return (_browser === gBrowser.selectedBrowser);
  }
  
  function updateSidebar() {
    var sb = EvenDeeperUI.getSidebar();
    if (sb && isSelectedTab()) {
      sb.updateUI(getState(), _page);
    }
  };
  
  function onDOMContentLoaded(e) {            
    // dont trigger for iframes
    if (e.originalTarget instanceof HTMLDocument) {
      var win = e.originalTarget.defaultView;
      if (win.frameElement) {
        return;
      }
    }
        
    // conjure up context for EvenDeeper.Main; basically we pass it
    // a doc handle and some callbacks    
    var context = { 
      doc: e.originalTarget, 
      onFinishedCalculatingSimilarities: onFinishedCalculatingSimilarities,
      onStartedCalculatingSimilarities: onStartedCalculatingSimilarities
    };
            
    dump("making new EvenDeeper.Page() in controller " + _id + "\n");
    
    _page = new EvenDeeper.Page(context);
    _page.process(context);    
  };
    
  browser.addEventListener("DOMContentLoaded", onDOMContentLoaded, true);  
  updateSidebar();
      
  return {
    onTabSelect: function() {    
      dump("tabSelect\n");
      updateSidebar();    
    }    
  };
};