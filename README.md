# Neo4ACL
## Access Control Lists on top of Neo4j

Inspired by [NODE ACL](https://github.com/OptimalBits/node_acl)



***
## Install
```bash
npm install neo4acl


```
## Setup & configuration
***

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
## Api
***
[acl.addUserToGroups()](#addUserToGroups)
[acl.removeUserFromGroups()](#removeUserFromGroups)
[acl.getUserGroups()](#getUserGroups)
[acl.isUserInAllGroups()](#isUserInAllGroups)
[acl.isUserInAnyGroup()](#isUserInAnyGroup)
[acl.addGroupParents()](#addGroupParents)
[acl.removeGroup()](#removeGroup)
[acl.removeResource()](#removeResource)
[acl.giveResourcesPermissions()](#giveResourcesPermissions)
[acl.denyResourcesPermission()](#denyResourcesPermission)
[acl.getUserResourcesPermissions()](#getUserResourcesPermissions)
[acl.hasUserAllPermissionsResource()](#hasUserAllPermissionsResource)
[acl.hasUserAnyPermissionsResource()](#hasUserAnyPermissionsResource)
[acl.hasAnyGroupPermissionsResource()](#hasAnyGroupPermissionsResource)

----------

### acl.addUserToGroups( user_id , groups, cb(err, done) {}) {#addUserToGroups}
Parameters:

- **user_id** {String || Number} User id
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [optional]
	- **err** {Object} A Neo4j REST API Layer error
	- **done** {Boolean}

Ad the user to the listed groups.

----------

### acl.removeUserFromGroups( user_id, groups, cb(err, done) {}) {#removeUserFromGroups}
Parameters:

- **user_id** {String || Number} User id
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [optional]
	- **err** {Object} A Neo4j REST API Layer error
	- **done** {Boolean}

Removes the user from the listed groups.

----------

### acl.getUserGroups( user_id, cb(err, groups) {}) {#getUserGroups}
Parameters:

- **user_id** {String || Number} User id
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **groups** {Array} The list of groups the user belongs to
```javascript
        groups = [
                    {
                        name: 'Role name',
                        distance: 1
                    },
                    {...}
                ] 
```
Returns an array of the groups the user belongs to.

For each group, the ```distance``` property tells if the user is a direct member of the group (if ```distance === 1```) or if she's N groups away.

----------

### acl.isUserInAllGroups( user_id, groups, cb(err, bool) {}) {#isUserInAllGroups}
Parameters:

- **user_id** {String || Number} User id 
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **bool** {Boolean}

Checks if the user belongs to each of the listed groups

----------

### acl.isUserInAnyGroup( user_id, groups, cb(err, bool) {}) {#isUserInAnyGroup}
Parameters:

- **user_id** {String || Number} User id 
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **bool** {Boolean}

Checks if the user belongs to any of the listed groups

----------

### acl.addGroupParents( group, parents, cb(err, done)) {#addGroupParents}
Parameters:

- **group** {String} Group
- **parents** {String || [String, ...]} Parent(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Set the given group as belonging to the listed parent groups.

----------

### acl.removeGroup( group, cb(err, done) {}) {#removeGroup}
Parameters:

- **group** {String} Group
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Removes the group and all it's permissions from the system.

----------

### acl.removeResource( resource_name, cb(err, done) {}) {#removeResource}
Parameters:

- **resource_name** {String} Resource name
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Removes the resource from the system.

----------

### acl.giveResourcesPermissions( groups, resources, permissions, cb(err, done) {}) {#giveResourcesPermissions}
Parameters:

- **groups** {String || [String, ...]} Group(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Gives to the listed groups the listed permissions over the listed resources.

----------

### acl.denyResourcesPermission( groups, resources, permissions, cb(err, done) {}) {#denyResourcesPermission}
Parameters:

- **groups** {String || [String, ...]} Group(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Removes the listed permissions over the listed resources from the listed groups.

----------

### acl.getUserResourcePermissions( user_id, resources, cb(err, resources) {}) {#getUserResourcesPermissions}
Parameters:

- **user_id** {String || Number} User id
- **resources** {String || [String, ...]} Resource(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **resources** {Array}
```javascript
        resources = [
                        {
                            name: 'Resource name',
                            permissions: [String, ...]
                        },
                        {...}
                    ]
```
Checks the permissions a user has over the listed resources.
Returns an array of resources.

----------

### acl.hasUserAllPermissionsResource( user_id, resources, permissions, cb(err, allowed) {}) {#hasUserAllPermissionsResource}
Parameters:

- **user_id** {String || Number} User id
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **allowed** {Boolean}

Checks if the user has ALL the listed permissions over all the listed resources.

----------

### acl.hasUserAnyPermissionsResource( user_id, resources, permissions, cb(err, allowed) {}) {#hasUserAnyPermissionsResource}
Parameters:

- **user_id** {String || Number} User id
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **allowed** {Boolean}

For each of the listed resources, checks if the user has ANY of the listed permission.

----------
    
### acl.hasAnyGroupPermissionsResource( groups, resources, permissions, callback(err, allowed) {}) {#hasAnyGroupPermissionsResource}
Parameters:

- **groups** {String || [String, ...]} Group(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **allowed** {Boolean}

Checks if any of the listed groups has ALL the listed permissions over all the listed resources.