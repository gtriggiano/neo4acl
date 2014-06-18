# Api
---


## Index
---
[acl.addUserToGroups()](#acladdusertogroups-user_id-groups-cberr-done-)

[acl.removeUserFromGroups()](#aclremoveuserfromgroups-user_id-groups-cberr-done-)

[acl.getUserGroups()](#aclgetusergroups-user_id-cberr-groups-)

[acl.isUserInAllGroups()](#isUserInAllGroups)

[acl.isUserInAnyGroup()](#isUserInAnyGroup)

[acl.addGroupParents()](#addGroupParents)

[acl.removeGroup()](#removeGroup)

[acl.removeResource()](#removeResource)

[acl.giveResourcesPermissions()](#giveResourcesPermissions)

[acl.denyResourcesPermission()](#denyResourcesPermission)

[acl.getResourcesPermissions()](#getResourcesPermissions)

[acl.isAllowed()](#isAllowed)

[acl.isAllowedAny()](#isAllowedAny)

[acl.areAnyGroupsAllowed()](#areAnyGroupsAllowed)

----------

### acl.addUserToGroups( user_id, groups, cb(err, done) )
Parameters:

- **user_id** {String || Number} User id
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [optional]
	- **err** {Object} A Neo4j REST API Layer error
	- **done** {Boolean}

Ad the user to the listed groups.

----------

### acl.removeUserFromGroups( user_id, groups, cb(err, done) )
Parameters:

- **user_id** {String || Number} User id
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [optional]
	- **err** {Object} A Neo4j REST API Layer error
	- **done** {Boolean}

Removes the user from the listed groups.

----------

### acl.getUserGroups( user_id, cb(err, groups) )
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

### <a id="isUserInAllGroups"></a>acl.isUserInAllGroups( user_id, groups, cb(err, bool) )
Parameters:

- **user_id** {String || Number} User id 
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **bool** {Boolean}

Checks if the user belongs to each of the listed groups

----------

### <a id="isUserInAnyGroup"></a>acl.isUserInAnyGroup( user_id, groups, cb(err, bool) )
Parameters:

- **user_id** {String || Number} User id 
- **groups** {String || [String, ...]} Group(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **bool** {Boolean}

Checks if the user belongs to any of the listed groups

----------

### <a id="addGroupParents"></a>acl.addGroupParents( group, parents, cb(err, done) )
Parameters:

- **group** {String} Group
- **parents** {String || [String, ...]} Parent(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Set the given group as belonging to the listed parent groups.

----------

### <a id="removeGroup"></a>acl.removeGroup( group, cb(err, done) )
Parameters:

- **group** {String} Group
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Removes the group and all it's permissions from the system.

----------

### <a id="removeResource"></a>acl.removeResource( resource_name, cb(err, done) )
Parameters:

- **resource_name** {String} Resource name
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Removes the resource from the system.

----------

### <a id="giveResourcesPermissions"></a>acl.giveResourcesPermissions( groups, resources, permissions, cb(err, done) )
Parameters:

- **groups** {String || [String, ...]} Group(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Gives to the listed groups the listed permissions over the listed resources.

----------

### <a id="denyResourcesPermission"></a>acl.denyResourcesPermission( groups, resources, permissions, cb(err, done) )
Parameters:

- **groups** {String || [String, ...]} Group(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **done** {Boolean}

Removes the listed permissions over the listed resources from the listed groups.

----------

### <a id="getResourcesPermissions"></a>acl.getResourcesPermissions( user_id, resources, cb(err, resources) )
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

### <a id="isAllowed"></a>acl.isAllowed( user_id, resources, permissions, cb(err, allowed) )
Parameters:

- **user_id** {String || Number} User id
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **allowed** {Boolean}

Checks if the user has ALL the listed permissions over all the listed resources.

----------

### <a id="isAllowedAny"></a>acl.isAllowedAny(user_id, resources, permissions, cb(err, allowed) )
Parameters:

- **user_id** {String || Number} User id
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **allowed** {Boolean}

For each of the listed resources, checks if the user has ANY of the listed permission.

----------
    
### <a id="areAnyRolesAllowed"></a>acl.areAnyRolesAllowed( groups, resources, permissions, callback(err, allowed) )
Parameters:

- **groups** {String || [String, ...]} Group(s)
- **resources** {String || [String, ...]} Resource(s)
- **permissions** {String || [String, ...] Permission(s)
- **cb** {Function} [Optional]
    - **err** {Object} A Neo4j REST API Layer error
    - **allowed** {Boolean}

Checks if any of the listed groups has ALL the listed permissions over all the listed resources.