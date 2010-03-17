// nlp utilities for even deeper
// author: James Salter 2010

var NLP = {};

NLP.AccentRemover = function() {
  var _accentRegexes = null;
	var _accentReplacements = null;			
	var _masterRegex = null;
	
  return {
    removeAccents: function(r) {
  	  if (_accentRegexes === null) {
  	    _accentRegexes = [];
  	    _accentRegexes.push(new RegExp("[àáâãäå]", 'g'));
  	    _accentRegexes.push(new RegExp("æ", 'g'));
  	    _accentRegexes.push(new RegExp("ç", 'g'));
  	    _accentRegexes.push(new RegExp("[èéêë]", 'g'));
  	    _accentRegexes.push(new RegExp("[ìíîï]", 'g'));
  	    _accentRegexes.push(new RegExp("ñ", 'g'));
  	    _accentRegexes.push(new RegExp("[òóôõö]", 'g'));
  	    _accentRegexes.push(new RegExp("[ùúûü]", 'g'));
  	    _accentRegexes.push(new RegExp("[ýÿ]", 'g'));
	    
  	    _accentRegexes.push();    
  	    _accentReplacements = ['a', 'ae', 'c', 'e', 'i', 'n', 'o', 'u', 'y'];
	    
  	    _masterRegex = new RegExp("[àáâãäå]|æ|ç|[èéêë]|[ìíîï]|ñ|[òóôõö]|[ùúûü]|[ýÿ]", 'g');
  	  }	

      return r.replace(_masterRegex, function(str) {
        for (i in _accentRegexes) {
          str = str.replace(_accentRegexes[i], _accentReplacements[i]);          
        }
                    
        return str;
      });    
    }
	};
	
}();

NLP.Document = function(text) {
	var _text = text;
	
	// associative array of the frequencies of each word
	var _wordCounts = null;
	var _numWords = null;
	var _tfidfs = null;
	var _termFrequencies = null;
	var _stopWords = [ 'a', 'also', 'an', 'and', 'as', 'at', 'be', 'but', 'by', 
                     'can', 'could', 'do', 'for', 'from', 'go', 'have', 'he', 'her',
                     'here', 'his', 'how', 'i', 'if', 'in', 'into', 'it', 'its',
                     'my', 'of', 'on', 'or', 'our', 'say', 'she', 'that', 'the', 
                     'their', 'there', 'therefore', 'they', 'this', 'these', 'those',
                     'through', 'to', 'until', 'we', 'what', 'when', 'where', 'which',
                     'while', 'who', 'with', 'would', 'you', 'your'];
                     
	
	return {
		text: function() { return _text; },
		
		wordCounts: function() {
			if (_wordCounts === null) {				  
				_wordCounts = {};					
				// split document into separate words
				var words = _text.split(/\s/);
												
				$.each(words, function(i, word) {
					word = word.toLowerCase();
					// remove trailing and leading non-alphanumeric chars
					word = word.replace(/[^a-z0-9]+$/, "");
					word = word.replace(/^[^a-z0-9]+/, "");
					
					// convert accents to ascii chars
					word = NLP.AccentRemover.removeAccents(word);

					if (word.length != 0) {					
  					if (!_wordCounts[word]) {
  						_wordCounts[word] = 1;
  					} else {
  						_wordCounts[word] = _wordCounts[word] + 1;
  					}
  				}  				
				});				

  		  // save number of words
				_numWords = words.length;
																			
				// kill stop words
				$.each(_stopWords, function(i, stopWord) {
          if (stopWord in _wordCounts) {
            delete _wordCounts[stopWord];
            --_numWords;
          }
  		  });
			}
			
			return _wordCounts;
		},
				
		termFrequencies: function() {
		  if (_termFrequencies === null) {
		    var wordCounts = this.wordCounts();
  			_termFrequencies = {};

  			for (var word in wordCounts) {
  			  _termFrequencies[word] = wordCounts[word] / _numWords;
  			}  			
		  }		  
			
			return _termFrequencies;
		},
		
		// term frequency * inverse document frequency
		tfidfs: function() {
			if (_tfidfs === null) {							
				_tfidfs = {};
													      				
				var termFrequencies = this.termFrequencies();
				
				// return a normalized vector, so we accumulate the sum of squared values
				var mag_sum = 0;
												
				for (var term in termFrequencies) {				
				  var val = termFrequencies[term] * NLP.Corpus.idf(term);
					_tfidfs[term] = val;
					mag_sum += (val * val);
				}								
				
			  var mag = Math.sqrt(mag_sum);
			  
			  // divide all elements by magnitude
			  for (term in _tfidfs) {
			    _tfidfs[term] = mag;
			  }
			}
			
			return _tfidfs;
		},
		
		clearTfIdfs: function() {
		  _tfidfs = null;		  
		}
	};
};

NLP.Corpus = function() {  
	var _documents = [];
	var _unionTerms = null;
	var _idfs = {};
	
	return {		
		// inverse document frequency
		idf: function(term) {
		  if (!(term in _idfs)) {		    		    
		    var count = 0;
  			// find num docs where the term appears
  			for (var i in _documents) {				
  				if (_documents[i].wordCounts()[term]) { ++count; }					
  			}
			
  			if (count == 0) { 
  			  console.log("warning: idf is 0 for term " + term);
  			  return 0;
  		  }
			
  			_idfs[term] = Math.log(_documents.length / count);  			
  		}
  		
  		return _idfs[term];
		},
						
		unionTerms: function() {
		  if (_unionTerms === null) {
		    _unionTerms = {};
		    $.each(_documents, function(i, doc) {		      
		      var wordCounts = doc.wordCounts();
		      for (var term in wordCounts) {
		        _unionTerms[term] = 0;
		      }
		    });		    		    
		  }
		  
		  return _unionTerms;
		},	
    										
		docSimilarity: function(doc1, doc2) {		  		  
			var tfidfs1 = doc1.tfidfs();									
			var tfidfs2 = doc2.tfidfs();
			
			var dotproduct = 0;
			
			var unionTerms = NLP.Corpus.unionTerms();
			
			for (var term in unionTerms) {
				var delta = 0;
				
				var tfidf1 = tfidfs1[term] ? tfidfs1[term] : delta;				
				var tfidf2 = tfidfs2[term] ? tfidfs2[term] : delta;    
						
				dotproduct += (tfidf1 * tfidf2);				
			}
			
			// note we can just return the dot product because 
			// the tf-idf vectors are already normalized
			return dotproduct;
		},
		
		addDocument: function(document) {	
		  _documents.push(document);
		  
		  // discard cached stuff
		  _unionTerms = null;
		  _idfs = {};		  
		  
		  $.each(_documents, function(index, doc) {
		    doc.clearTfIdfs();
		  });
		}
	};
}();

NLP.Debug = function() {
  return {
    dumpUnionTerms: function() {
  	  for (var term in NLP.Corpus.unionTerms()) {	    
  	    $(document.body).append(term + "<br />");
  	  }
  	},
  	
  	dumpDocumentTfIdf: function(doc) {
  	  var tfidfs = doc.tfidfs();
  	  
  	  for (var term in tfidfs) {
  	    $(document.body).append(term + ", idf: " + NLP.Corpus.idf(term) + " tfidf: " + tfidfs[term] + "<br />");
  	  }
  	},
  	
  	msg: function(msg) {
  	  console.log(msg);  	  
  	}
  };
}();