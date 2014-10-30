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

        return ngPouch.db.query(x).then(
          function(res) {
            return ngPouch.db.allDocs({
              conflicts: true,
              include_docs : true,
              keys: res.rows.map(function(x) {return x.id})
            });
          }
        );

      }

}});