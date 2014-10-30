'use strict';

// http://guide.couchdb.org/draft/conflicts.html

angular.module('app.pouch_conflict', ['ngPouch'])
  .service('PouchConflict', function(ngPouch) {

    return {
      all: function() {
        var x = function(doc) {
          if(doc._conflicts) {
            emit(doc._conflicts, null);
          }
        }
        return ngPouch.db.query(x, {descending: true, include_docs : true});
      }
    };
  });