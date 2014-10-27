angular.module('app.todoCtrl', ['ngPouch'])
  .controller('TodoController', ['$scope', 'ngPouch','Todo', function($scope, ngPouch, Todo) {

    $scope.form = {};
    $scope.todos = [];

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

  }]);