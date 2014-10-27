var express = require('express')
var app = express()

app.use(express.static(__dirname + '/www'));
app.use(express.static(__dirname + '/bower_components'));
app.listen(process.env.PORT || 9292);

