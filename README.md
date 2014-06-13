# Neo4ACL
### Access Control Lists on top of Neo4j

Inspired by [NODE ACL](https://github.com/OptimalBits/node_acl)

***
## Install
```
#!bash
npm install neo4acl


```
## Setup & configuration
***

```
#!javascript

var Neo4ACL = require('neo4acl');

var acl = Neo4ACL(options);

/*

The Neo4ACL() function takes an optional configuration object

options = {

	url: 						The Neo4j REST server url.
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
## Api
***
### acl.addUserRoles( userId , roles, callback(err, done) {})
Give role(s) to user. 

Parameters:

- **userId** {String || Number} User id
- **roles** {String || [String]} Role (or collection of roles) to give to user
- **callback** {Function} [optional]
	- **err**
	- **done** {Boolean}


### acl.removeUserRoles( userId, roles, callback(err, done) {})
### acl.userRoles( userId, callback(err, roles) {})
### acl.userHasAllRoles( userId, roles, callback(err, has) {})
### acl.userHasAnyRole( userId, roles, callback(err, has) {})
### acl.addRoleParents( role, parents, callback(err, done))
### acl.removeRole( role, callback(err, done) {})
### acl.removeResource( resourceId, callback(err, done) {})
### acl.allow( roles, resources, permissions, callback(err, done) {})
### acl.removeAllow( roles, resources, permissions, callback(err, done) {});
### acl.allowedPermissions( userId, resources, callback(err, resources) {});
### acl.isAllowed(userId, resource, permissions, callback(err, allowed) {});
### acl.areAnyRolesAllowed( roles, resources, permissions, callback(err, allowed) {});

## Middleware generator
***

