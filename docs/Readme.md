# Neo4ACL
## Access Control Lists on top of Neo4j

Inspired by [NODE ACL](https://github.com/OptimalBits/node_acl)

----------

## Install
```bash
npm install neo4acl
```

----------


## Setup & configuration


```javascript

var Neo4ACL = require('neo4acl');

var acl = Neo4ACL(options);

/*

The Neo4ACL() function takes an optional configuration object

options = {

    url: 					    The Neo4j REST server url.
						        Default: process.env.NEO4J_URL || 'http://localhost:7474'
					
    user_label: 				Label of nodes representing users.
    							Default: 'User'
    
    user_id_key:				Name of the user id property.
    							Default: '_id'
    				
    group_label:				Label of nodes representing usergroups.
    							Default: 'Usergroup'
    				
    group_name_key: 			Name of the group name property.
    							Default: 'name'
    				
    res_label: 					Label of nodes representing resources.
    							Default: 'Resource'
    				
    res_id_key:					Name of the resource id property.
    							Default: '_id'
    				
    belongs:					Name of the relation connecting user to group and group to group
    							Default: 'BELONGS_TO'
    				
    has_permission: 			Name of the relation connecting group to resource
	    						Default: 'HAS_PERMISSION'
    				
    has_permission_list_key: 	Name of the relation property containing the permissions list.
    						 	Default: 'list'
}

*/

```


## (more) Quick connect/express middleware example

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
            function(req, res) {
            
            });

app.post('/rest/news',
            acl.mw.hasAllPermissionsOnResources('news', 'post'),
            function(req, res) {});

app.put('/rest/news/:uuid',
            acl.mw.hasAllPermissionsOnResources('news_{uuid}', ['put'],
            function(req, res) {});

app.listen(8080);

```

## Graph desing
![Grafo](img/base_graph.png)