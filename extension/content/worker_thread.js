// ff3 specific threading stuff yanked from https://developer.mozilla.org/en/The_Thread_Manager
var mainThread = function(threadID, scores, callback) {
  this.threadID = threadID;
  this.scores = scores;
  this.callback = callback;
};

mainThread.prototype = {
  run: function() {
    try {
      // send notification to even deeper that we're done
      this.callback(this.scores);
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
var workingThread = function(threadID, context) {
  this.threadID = threadID;  
  this.context = context;
};

workingThread.prototype = {
  run: function() {
    try {
      var scores = EvenDeeper.Similarity.findArticleSimilarities(this.context.currentDoc, this.context.articles, this.context.corpus);
      // notify main thread
      this.context.mainThreadInstance.dispatch(new mainThread(this.threadID, scores, this.context.callback),
        this.context.backgroundThreadInstance.DISPATCH_NORMAL);
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
