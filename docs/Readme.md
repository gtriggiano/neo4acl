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

## (not so) Quick API example


```javascript

var Neo4acl = require('neo4acl');

var acl = Neo4acl();

// Let's say we already have two users in the graph
// {_id:'giacomo'} and {_id:'bob'}
// and no groups or resources

var giacomo_groups; // <- We'll use this variable later...

acl
  .addUserToGroups('giacomo', ['admins', 'italian_users']).execute()
  .then(acl.addUserToGroups('bob', ['english_users']).execute)
  .then(acl.addGroupParents('admins', 'users').execute)
  .then(acl.addGroupParents('italian_users', ['users']).execute)
  .then(acl.addGroupParents('english_users', 'users').execute)
  .then(acl.giveResourcesPermissions('italian_users', 'italian_content', ['view']).execute)
  .then(acl.giveResourcesPermissions('english_users', 'english_content', ['view']).execute)
  .then(acl.giveResourcesPermissions('users', 'common_content', ['view']).execute)
  .then(acl.giveResourcesPermissions('admins', [
                                                'common_content',
                                                'italian_content',
                                                'english_content'
                                                ],
                                                ['view', 'post', 'put', 'delete', 'special_permission']
                                    ).execute)

  .then(acl.isUserInAllGroups('giacomo', ['admins', 'italian_users']).execute)
  .then(function(giacomo_is) {
    console.log('\nGiacomo is member of admins AND italian_users: ' + giacomo_is); // -> true

    return acl.isUserInAllGroups('bob', ['english_users', 'admins']).execute();
  })      
  .then(function(bob_is) {
    console.log('\nBob is member of english_users AND admins: ' + bob_is); // -> false

    return acl.isUserInAnyGroup('bob', ['english_users', 'admins']).execute();
  })
  .then(function(bob_is) {
    console.log('\nBob is member of english_users OR admins: ' + bob_is); // -> true

    return acl.hasUserAllPermissionsOnResources('bob', 'english_content', 'view', function(err, has_bob) {
      console.log('\nBob can \'view\' english_content: ' + has_bob); // -> true
    });
  })
  .then(function() {
    var acl_query = acl.hasUserAllPermissionsOnResources('giacomo', ['italian_content', 'english_content', 'common_content'], ['view', 'post', 'special_permission']);

    console.log('\nLet\'s wait 5 seconds....');
    setTimeout(function() {
      acl_query.execute();
    }, 100);

    acl_query.then(function(has_giacomo) {
      console.log(
                  ['\nGiacomo has permissions \'view\', \'post\' and \'special_permission\'',
                   'on resources \'italian_content\', \'english_content\' and \'common_content\': ' + has_giacomo
                  ].join('\n')
                 );
    });

    return acl_query;
  })   
  .then(function() {
    return acl.denyResourcesPermission('english_users', 'english_content', 'view', function(err, done) {
      console.log('\nNow english users CAN NOT \'view\' english_content.');
    });
  })
  .then(function() {
    return acl.hasUserAllPermissionsOnResources('bob', 'english_content', 'view', function(err, bool) {
      console.log('\nBob can \'view\' english_content: ' +bool); // -> false
    });
  })
  .then(function() {
    return acl.hasUserAllPermissionsOnResources('bob', 'common_content', 'view', function(err, bool) {
      console.log('\nBob can \'view\' common_content: ' +bool);// -> true
    });
  })
  .then(function() {
    return acl.getUserGroups('bob', function(err, groups) {
      console.log('\nBob is in the following groups:');
      console.log(util.inspect(groups, {depth: null}));
    });
  })
  .then(function() {
    return acl.getUserGroups('giacomo', function(err, groups) {
      giacomo_groups = groups; // Here we are...
      console.log('\nGiacomo is in the following groups:');
      console.log(util.inspect(groups, {depth: null}));
    });
  })
  .then(function(g_groups) {
    if (giacomo_groups === g_groups) console.log('\nIn Neo4acl the same objects are used both to resolve promises and to feed callbacks.');
  });
  
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