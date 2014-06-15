# Neo4ACL
### Access Control Lists on top of Neo4j

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
### acl.addUserRoles( userId , roles, cb(err, done) {})
Gives role(s) to an user. 

Parameters:

- **userId** {String || Number} User id
- **roles** {String || [String, ...]} Role(s)
- **cb** {Function} [optional]
	- **err** {Object} A Neo4j REST API Layer error
	- **done** {Boolean}


### acl.removeUserRoles( userId, roles, cb(err, done) {})
Removes role(s) from an user.

Parameters:

- **userId** {String || Number} User id
- **roles** {String || [String, ...]} Role(s)
- **cb** {Function} [optional]
	- **err** {Object} A Neo4j REST API Layer error
	- **done** {Boolean}

### acl.userRoles( userId, callback(err, roles) {})
Returns the list of the user's roles.

Parameters:

- **userId** {String || Number} User id
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **roles** {Array} The list of user's roles
```javascript
        roles = [
                    {
                        name: 'Role name',
                        distance: 1
                    },
                    {...}
                ] 
```

### acl.userHasAllRoles( userId, roles, callback(err, has) {})
Checks if the user has each of the listed roles

Parameters:

- **userId** {String || Number} User id 
- **roles** {String || [String, ...]} Role(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **has** {Boolean}

### acl.userHasAnyRole( userId, roles, callback(err, has) {})
Checks if the user has any of the listed roles

Parameters:

- **userId** {String || Number} User id 
- **roles** {String || [String, ...]} Role(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **has** {Boolean}

### acl.addRoleParents( role, parents, callback(err, done))
Defines the listed parents as containers of the passed role

Parameters:

- **role** {String} Role
- **roles** {String || [String, ...]} Parent(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

### acl.removeRole( role, callback(err, done) {})
Removes the role and all it's permissions from the system

Parameters:

- **role** {String} Role
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

### acl.removeResource( resourceId, callback(err, done) {})
Removes the resource from the system

Parameters:

- **resourceId** {String} Resource string
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

### acl.allow( roles, resources, permissions, callback(err, done) {})
Gives to the listed roles the listed permissions over the listed resources

Parameters:

- **roles** {String || [String, ...]} Role(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

### acl.removeAllow( roles, resources, permissions, callback(err, done) {});
Removes the listed permissions over the listed resources from the listed roles  

Parameters:

- **roles** {String || [String, ...]} Role(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

### acl.allowedPermissions( userId, resources, callback(err, resources) {});
Checks the permissions owned by a user over the listed resources.
Returns a list of objects mapping every resource with the owned permissions.

Parameters:

- **userId** {String || Number} User id
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

### acl.isAllowed(userId, resources, permissions, callback(err, allowed) {});
Checks if the user has all the listed permissions over all the listed resources. 

Parameters:

- **userId** {String || Number} User id
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **allowed** {Boolean}

### acl.areAnyRolesAllowed( roles, resources, permissions, callback(err, allowed) {});
## Middleware generator
***

