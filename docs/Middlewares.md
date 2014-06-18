# Connect/Express Middlewares


## Quick connect/express middleware example

```javascript

var express = require('express');
var Neo4acl = require('neo4acl');

var acl = Neo4acl();
var app = express();

app.use(acl.mw.initialize());

app.get('/', function(req, res) {
  var text = 'Hi, your user id is: '+ req.neo4acl.user_id;
      text += '<br>';
      text += 'Enter the <a href="/admin">admin area</a>';
        
  res.send(text);
});

app.get('/admin',
        acl.mw.belongsToAll('admin'),
        function(req, res) {
          res.send('Hello admin');
        });

app.post('/rpc/sendChristmasGreetings',
          acl.mw.hasAllPermissionsOnResources(
            ['mailing_procedure', 'christmas_actions'],
            ['execute'],
            {
              fail_callback: function(req, res, next) {
                // If the permission check fails you can use
                // otions.fail_callback to control the failing procedure.
                // Default procedure is res.send(401)
                        
                // It's christmas! Let pass the request anyway....
                next();
              }
            }
          ),
          function(req, res) {});

app.post('/rest/news',
          acl.mw.hasAllPermissionsOnResources('news', 'post'),
          function(req, res) {});

app.put('/rest/news/:uuid',
          acl.mw.hasAllPermissionsOnResources(
            ['news_{uuid}', '{type}_objects'], // You can use params from req.param()
            ['put'],
            {
              // You can also provide a params_fallbacks hash
              params_fallbacks: {
                type: 'news'
              }
            }
        ),
        function(req, res) {});

app.listen(8080);

```
