'use strict';

angular.module('app.todo', ['ngPouch','uuid'])
  .service('Todo', function(rfc4122, ngPouch, $rootScope) {

    return {

      destroy: function(obj) {
        ngPouch.db.remove(obj.doc);
      },

      update: function(obj) {
        ngPouch.db.put(obj.doc);
      },

      add: function(obj) {
        obj._id = 'todo_'+rfc4122.v4();
        obj.doc_type = 'todo';
        obj.created_at = new Date();
        return ngPouch.db.put(obj);
      },

      all: function() {
        var allTodos = function(doc) {
          if (doc.doc_type === 'todo') {
            emit(doc.created_at, doc._id);
          }
        }
        return ngPouch.db.query(allTodos, {descending: true, include_docs : true});
      }
    };
  });