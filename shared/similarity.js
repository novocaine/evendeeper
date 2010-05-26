// module for calculating similarities between the current article and an array of other articles.
// splits the work up into tasks separated by timeouts to avoid blocking.
//
// currentArticle is the Article to do all the comparing to, otherArticles is an array
// of Articles to compare the first article to, _corpus is the instance of NLP.corpus.

EvenDeeper.Similarity = function(_currentArticle, _otherArticles, _corpus) {  
  var _index = 0;
  var _scores = [];
  var _start = null;
  var _doneProcessingCallback = null;
  
  function processArticles() {
    if (_index >= _otherArticles.length) {
      return;
    }
    
    var article = _otherArticles[_index]; 
    var sim = _corpus.docSimilarity(_currentArticle.nlpdoc, article.nlpdoc);
    
    _scores.push({ article: article, similarity: sim });
        
    ++_index;
    
    if (_index == _otherArticles.length) {
      
      _scores.sort(function(score_a, score_b) {
        return (score_b.similarity - score_a.similarity);
      });

      var end = new Date().getTime();

      EvenDeeper.debug("similarity time: " + (end - _start) + "\n\n");
      
      _doneProcessingCallback(_scores);
    } else {
      setTimeout(processArticles, 10);
    }  
  }
  
  return {
    // calculates the similarities between a set of articles and the current article.
    // returns an array of articles sorted by similarity    
    run: function(doneProcessingCallback) {
      // clear previous cached tf-idf data. this is expensive (as it means it all has to be calculated again)
      // but usually necessary because if we're at this point, it means we have no prior cached result for
      // the current page - which means the current page wasn't already part of the corpus - which means
      // it was added and all the tf-idfs need to be recalculated. there's probably a better way, but this is safe for now.
      _corpus.clearCache();    
      _start = new Date().getTime();
      _doneProcessingCallback = doneProcessingCallback;
      
      if (_otherArticles.length > 0)
        processArticles();
			else
				throw "Empty article array passed to EvenDeeper.Similarity";
    }  
  };
};
