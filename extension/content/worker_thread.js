// ff3 specific threading stuff yanked from https://developer.mozilla.org/en/The_Thread_Manager
var mainThread = function(threadID, result, evendeeper) {
  this.threadID = threadID;
  this.result = result;
  this.evendeeper = evendeeper;
};

mainThread.prototype = {
  run: function() {
    try {
      // send notification to even deeper that we're done
      this.evendeeper.getOnFinishedCalculatingSimilarities()(this.evendeeper);
    } catch(err) {
      Components.utils.reportError(err);
    }
  },
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

// takes as argument an id and an EvenDeeper.Main instance
var workingThread = function(threadID, evendeeper) {
  this.threadID = threadID;
  this.result = 0;
  this.evendeeper = evendeeper;
};

workingThread.prototype = {
  run: function() {
    try {
      this.evendeeper.findArticleSimilarities();      
      // notify main thread
      this.evendeeper.mainThreadInstance().dispatch(new mainThread(this.threadID, this.result, this.evendeeper),
        this.evendeeper.backgroundThreadInstance().DISPATCH_NORMAL);
    } catch(err) {
      Components.utils.reportError(err);
    }
  },
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};
