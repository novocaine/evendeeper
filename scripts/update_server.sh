

DEST_ROOT=novocaine@deckardsoftware.com:deckardsoftware.com/evendeeper/bookmarklet

# concatenate all required js files into one big one; this both speeds load 
# and eliminates race conditions that would otherwise be associated with loading all dependencies

rm tmp/evendeeper_bookmarklet.js
cat shared/even_deeper.js shared/nlp.js shared/article.js shared/google_reader_shared.js shared/article_extractor.js shared/html_parser.js shared/similarity.js bookmarklet/bookmarklet.js bookmarklet/bookmarklet_ui.js bookmarklet/bookmarklet_page_controller.js >> tmp/evendeeper_bookmarklet.js

rsync -zv tmp/evendeeper_bookmarklet.js bookmarklet/bookmarklet.css $DEST_ROOT/
