angular.module('app.todoCtrl', ['ngPouch'])
  .controller('TodoController', ['$scope', 'ngPouch','Todo', function($scope, ngPouch, Todo) {

    $scope.form = {};
    $scope.todos = [];
    $scope.logged_in = false;
    $scope.ng_pouch = ngPouch;

    ngPouch.publish(function() {
      return Todo.all()
        .then( function(results) {
          $scope.todos = results["rows"];
        });
    });

    $scope.updateTodo = function (todo) {
      Todo.update(todo);
    };

    $scope.addTodo = function () {
      Todo.add({text:$scope.todoText, done:false});
      $scope.todoText = '';
    };

    $scope.remaining = function() {
      var count = 0;
      angular.forEach($scope.todos, function(todo) {
        count += todo.doc.done ? 0 : 1;
      });
      return count;
    };

    $scope.login = function() {
      ngPouch.saveSettings({database:'http://localhost:5984/test1',
        stayConnected: true });
      $scope.logged_in = true;

    };

    $scope.logoff = function() {
      ngPouch.saveSettings({database:'http://localhost:5984/test1',
        stayConnected: false });
      if( typeof ngPouch.remotedb != "undefined") {
        ngPouch.remotedb.logoff();
      }
      $scope.logged_in = false;
      $scope.apply();
    };


    $scope.archive = function() {
      angular.forEach($scope.todos, function(todo) {
        Todo.destroy(todo);
      });
    };

    if( typeof ngPouch.remotedb != "undefined") {
      ngPouch.remotedb.logoff();
    }
    $scope.logged_in = false;


  }]);