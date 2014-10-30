angular.module('app.todoCtrl', ['ngPouch'])
  .controller('TodoController', ['$scope', '$q', 'ngPouch','Todo', 'PouchConflict',
    function($scope, $q, ngPouch, Todo, PouchConflict) {

    $scope.form = {};
    $scope.todos = [];
    $scope.logged_in = false;
    $scope.ng_pouch = ngPouch;
    //ngPouch.reset();

    ngPouch.publish(function() {
      var p1 = Todo.all()
        .then( function(results) {
          $scope.todos = results["rows"];
        });

      var p2 = PouchConflict.all()
        .then ( function(results) {
          $scope.conflicts = results;

        });
      return $q.all([p1,p2]);
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
      ngPouch.saveSettings({database:'http://localhost:5984/test20',
        stayConnected: true });
      $scope.logged_in = true;

    };

    $scope.logoff = function() {
      ngPouch.logoff();
      $scope.logged_in = false;
    };


    $scope.archive = function() {
      angular.forEach($scope.todos, function(todo) {
        Todo.destroy(todo);
      });
    };

  }]);