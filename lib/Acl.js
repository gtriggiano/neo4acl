var _ = require('underscore');
var seraph = require('seraph');
var Args = require('args-js');

var Middleware = require('./Middleware');
var RichPromise = require('./RichPromise');

// Regular expression dictionary for string replacement
// in the cypher query strings
var regex = {
  user_label: new RegExp('User\\b', 'g'),
  user_id_key: new RegExp('user_id', 'g'),
  group_label: new RegExp('Usergroup\\b', 'g'),
  group_name_key: new RegExp('group_name', 'g'),
  res_label: new RegExp('Resource\\b', 'g'),
  res_id_key: new RegExp('resource_id', 'g'),
  belongs: new RegExp('BELONGS_TO', 'g'),
  belongs_since_key: new RegExp('belongs_since', 'g'),
  has_permission: new RegExp('HAS_PERMISSION', 'g'),
  has_permission_list_key: new RegExp('permission_list', 'g')
};

var defaults = {
  url: process.env.NEO4J_URL || 'http://localhost:7474',
  user_label: 'User',
  user_id_key: '_id',
  group_label: 'Usergroup',
  group_name_key: 'name',
  res_label: 'Resource',
  res_id_key: '_id',
  belongs: 'BELONGS_TO',
  belongs_since_key: 'since',
  has_permission: 'HAS_PERMISSION',
  has_permission_list_key: 'list'
};

/**
 * Neo4acl class
 * @author Giacomo Triggiano
 */
var ACL = function(opts) {

  this.settings = _.extend({}, defaults, opts);
  this.db = seraph(this.settings.url);
  this.mw = Middleware(this);
  this.models = require('./models.js')(this.db, this.settings);

};

// "private" methods

/**
 * Given a user id returns an object useful to be
 * used as an user parameter in a cypher query
 *
 * @param {String|Number} userId User id
 *
 * @returns {
 *            _id: userId
 *          }
 * @type Object
 */
ACL.prototype._serializeUser = function(user_id) {
  var ret = {};
  ret[this.settings.user_id_key] = user_id;
  return ret;
};

/**
 * Given a group name returns an object useful to be
 * used as a group parameter in a cypher query
 *
 * @param {String|Number} groupName Group name
 *
 * @returns {
 *            name: groupName
 *          }
 * @type Object
 */
ACL.prototype._serializeUsergroup = function(group_name) {
  var ret = {};
  ret[this.settings.group_name_key] = group_name;
  return ret;
};

/**
 * Given a resource id returns an object useful to be
 * used as a resource parameter in a cypher query
 *
 * @param {String|Number} resourceId Resource id
 *
 * @returns {
 *            _id: resourceId
 *          }
 * @type Object
 */
ACL.prototype._serializeResource = function(resource_id) {
  var ret = {};
  ret[this.settings.res_id_key] = resource_id;
  return ret;
};

/**
 * Given a CoUS representing a set of permissions
 * returns an object useful to be used
 * as a permission parameter in a cypher query
 *
 * @param {Array} list Permissions list
 *
 * @returns {
 *            list: list
 *          }
 * @type Object
 */
ACL.prototype._serializePermission = function(permission_list) {
  var ret = {};
  ret[this.settings.has_permission_list_key] = permission_list;
  return ret;
};

/**
 * Given an integer returns an hash of numbered labels
 *
 * @param {Number} num It's an integer
 *
 * @returns labelN = {
 *            group: group{num},
 *            user: user{num},
 *            rel: rel{num},
 *          }
 * @type Object
 */
ACL.prototype._getNumberedLabels = function(num) {
  var args = Args([
               {num: Args.INT | Args.Optional,
                _default: 0}
             ], arguments);

  return {
    group: 'group'+ args.num,
    user: 'user'+ args.num,
    rel: 'rel'+ args.num,
    res: 'res'+ args.num
  }
}; //OK

/**
 * _renameIdentifiers(query_string)
 *
 * Replace the identifiers in the query string with the
 * with those provided by the user or the default ones
 *
 * @param {Number} query_string The query string to parse
 *
 * @returns A new query string
 * @type String
 */
ACL.prototype._renameIdentifiers = function(query_string) {
  var acl = this;
  var query = query_string;

  for (var k in regex) {
    if (regex.hasOwnProperty(k) && acl.settings.hasOwnProperty(k)) {
      query = query.replace(regex[k], acl.settings[k]);
    }
  }

  return query;
};

/**
 * Ensures a Collection of Unique Strings (CoUS) :)
 *
 * Flow:
 *
 * If {string} is passed: returns [{string}]
 * If {array} is passed: returns CoUS from {array}
 * returns []
 *
 * @private
 *
 * @param {String} string A string to put in an array
 * @param {Array} list An array to convert to CoUS
 * @returns A CoUS
 * @type Array
 */
ACL.prototype._ensureCoUS = function(string, list) {
  if (_.isString(string)) return [string];
  if (_.isArray(list)) {
    list = _(list).filter(function(str) {
      return _.isString(str);
    });
    return _.uniq(list);
  }
  return [];
};


// "public" API

/**
 * addUserRoles( userId, roles, function(err, done) )
 *
 * Adds roles to a given user.
 *
 * @param {String|Number} User id.
 * @param {String|Array} Role(s) to add to the user id.
 * @param {Function} Callback called when finished.
 * @return
*/
ACL.prototype.addUserToGroups = function(user_id, groups, cb) {
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);


  var parameters = {
    user: acl._serializeUser(args.user_id),
    groups: args.groups
  };

  var query = [
  'MATCH (user:User {user_id:{user}.user_id})',
  'FOREACH (name IN {groups} |',
  '  MERGE (group:Usergroup {group_name:name})',
  '  MERGE (user)-[rel:BELONGS_TO]->(group)',
  '    ON CREATE SET rel.belongs_since = timestamp()',
  ')',
  'RETURN user'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    if (err) return false;
    return result.length ? true : false;
  });

};

/**
  removeUserRoles( userId, roles, function(err, done) )

  Remove roles from a given user.

  @param {String|Number} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
ACL.prototype.removeUserFromGroups = function(user_id, groups, cb) {
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

  var parameters = {
    user: acl._serializeUser(args.user_id),
    groups: args.groups
  };

  var query = [
  'MATCH (user:User {user_id:{user}.user_id})',
  'OPTIONAL MATCH (user)-[rel:BELONGS_TO]->(group)',
  'WHERE group.group_name IN {groups}',
  'DELETE rel',
  'RETURN DISTINCT user'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    if (err) return false;
    return result.length ? true : false;
  });

};

/**
 * getUserGroups( user_id, function(err, groups) )
 *
 * Return all the roles from a given user.
 * roles = [{
 *            name: String,
 *            distance: Number
 *          }]
 *
 * @param {String|Number} User id.
 * @param {Function} Callback called when finished.
 *
 * @return richPromise
 * @type {Object}
*/
ACL.prototype.getUserGroups = function(user_id, cb){
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

  var parameters = {
    user: acl._serializeUser(args.user_id)
  };

  var query = [
    'MATCH (user:User {user_id:{user}.user_id})-[rel:BELONGS_TO*]->(group:Usergroup )',
    'RETURN group.group_name AS name, length(rel) AS distance, REDUCE(since = 0, b IN rel | ',
    '                                                      CASE',
    '                                                        WHEN since >= b.belongs_since',
    '                                                        THEN since',
    '                                                        ELSE b.belongs_since',
    '                                                      END',
    '                                                    ) AS since'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, groups) {
    var _groups = _.groupBy(groups, 'name');
    var ret_groups = [];

    for (var k in _groups) {
      if (_groups.hasOwnProperty(k)) {
        var group_variants = _groups[k];
        var tmpGroup = {
          distance: _.min(group_variants, function(variant) { return variant.distance }).distance,
          since: _.min(group_variants, function(variant) { return variant.since }).since
        };
        tmpGroup[acl.settings.group_name_key] = k;
        ret_groups.push(tmpGroup);
      }
    }

    return ret_groups;
  });

};

/**
 * getGroupUsers( group, function(err, users) )
 *
 * Returns all the users belonging to the given group.
 *
 * @param {String} group Group
 * @param {Function} Callback called when finished.
 *
 * @return richPromise
 * @type {Object}
 */
ACL.prototype.getGroupUsers = function(group, cb) {
  var acl = this;

  var args = Args([
                    {group: Args.STRING | Args.Required},
                    {cb: Args.FUNCTION | Args.Optional}
                  ], arguments);

  var parameters = {
    group: args.group
  };

  var query = [
  'MATCH (group:Usergroup {group_name:{group}})<-[:BELONGS_TO*]-(user:User )',
  'RETURN DISTINCT user.user_id AS user_id'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, users) {
    return users;
  });

};

/**
 * userHasAllRoles( userId, roles, function(err, has, query, parameters) )
 *
 * Checks if the user has each of the listed roles
 *
 * @param {String|Number} User id.
 * @param {Function} Callback called when finished.
 * @return
*/
ACL.prototype.isUserInAllGroups = function(user_id, groups, cb) {
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

  var parameters = {
    user: acl._serializeUser(args.user_id),
    groups: args.groups
  };

  var query = [
  'MATCH (user:User {user_id:{user}.user_id})-[:BELONGS_TO*]->(group:Usergroup )',
  'WHERE group.group_name IN {groups}',
  'RETURN count(DISTINCT group.group_name) AS total'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return result.total === args.groups.length;
  });

}; // OK

/**
 * isUserInAnyGroup( user_id, groups, function(err, bool) )
 *
 * Checks if the user has any of the passed roles
 *
 * @param {String|Number} User id.
 * @param {Function} Callback called when finished.
 * @return
*/
ACL.prototype.isUserInAnyGroup = function(user_id, groups, cb) {
  var acl = this;

  var isUserInAllGroups = acl.isUserInAllGroups(user_id, groups);

  return RichPromise(acl, isUserInAllGroups.originalQuery, isUserInAllGroups.parameters, cb, function(err, result) {
    return result.total > 0;
  });

};

/**
 * addRoleParents(role, parents, function(err, done) )
 *
 * Adds a parent or parent list to role.
 *
 * @param {String} role Role to wich add the parents
 * @param {String|Array} parents Parent role(s) to add to role
 * @param {Function} Callback called when finished.
 *
 * @return
*/
ACL.prototype.addGroupParents = function(group, parents, cb) {
  var acl = this;

  var args = Args([
               {group: Args.STRING | Args.Required},
               [
                 {parent_string: Args.STRING},
                 {parent_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.parents is CoUS
             args.parents = acl._ensureCoUS(args.parent_string, args.parent_list);



  var parameters = {
    group: args.group,
    parents: args.parents
  };

  var query = [
  'MERGE (group:Usergroup {group_name:{group}})',
  'WITH group',
  'UNWIND {parents} AS parent',
  'MERGE (p:Usergroup {group_name:parent})',
  'MERGE (group)-[r:BELONGS_TO]->(p)',
  '  ON CREATE SET r.belongs_since = timestamp()',
  'WITH group, collect(p) AS pts',
  'RETURN group, pts'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return err ? false : true;
  });

};

/**
 * removeRole( role, function(err, done, query, parameters) )
 *
 * Removes a role from the system.
 *
 * @param {String} Role to be removed
 * @param {Function} Callback called when finished.
 *
 * @return
*/
ACL.prototype.removeGroup = function(group, cb) {
  var acl = this;

  var args = Args([
               {group: Args.STRING | Args.Required},
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

  var parameters = {
    group: acl._serializeUsergroup(args.group)
  };

  var query = [
  'MATCH (group:Usergroup {group_name:{group}.group_name})',
  'OPTIONAL MATCH (group)-[rels]-()',
  'DELETE rels, group'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return err ? false : true;
  });

};

/**
 * removeResource( resource, function(err, done, query, parameters) )
 *
 * Removes a resource from the system
 *
 * @param {String} resourceId Resource id
 * @param {Function} Callback called when finished.
 *
 * @return
*/
ACL.prototype.removeResource = function(resource_name, cb){
  var acl = this;

  var args = Args([
               {resource_name: Args.STRING | Args.Required},
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

  var parameters = {
    resource: acl._serializeResource(resource_name)
  };

  /*
  MATCH (res:Resource {_id:{res}._id})
  OPTIONAL MATCH (res)-[rels]-()
  DELETE rels, res
  */
  var query = [
  'MATCH (resource:Resource {resource_id:{resource}.resource_id})',
  'OPTIONAL MATCH (resource)-[rels]-()',
  'DELETE rels, resource'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return err ? false : true;
  });

};

/**
  allow( roles, resources, permissions, function(err, done, query, parameters) )

  Adds the given permissions to the given roles over the given resources.

  @param {String|Array} role(s) to add permissions to.
  @param {String|Array} resource(s) to add permisisons to.
  @param {String|Array} permission(s) to add to the roles over the resources.
  @param {Function} Callback called when finished.

  allow( permissionsArray, function(err) )

  @param {Array} Array with objects expressing what permissions to give.

  [{roles:{String|Array}, allows:[{resources:{String|Array}, permissions:{String|Array}]]

  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
ACL.prototype.giveResourcesPermissions = function(groups, resources, permissions, cb){
  var acl = this;

  var args = Args([
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permission_string: Args.STRING},
                 {permission_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);

             // Ensure args.roles is a CoUS
             args.permissions = acl._ensureCoUS(args.permission_string, args.permission_list);


  var parameters = {
    groups: args.groups,
    resources: args.resources,
    permissions: args.permissions
  };

  var query = [
  'FOREACH (group IN {groups} |',
  '  MERGE (g:Usergroup {group_name:group})',
  '  FOREACH (resource IN {resources} |',
  '    MERGE (r:Resource {resource_id:resource})',
  '    MERGE (g)-[rel:HAS_PERMISSION]->(r)',
  '      ON CREATE SET rel.permission_list = {permissions}',
  '      ON MATCH SET rel.permission_list = rel.permission_list + [str IN {permissions} WHERE NOT str IN rel.permission_list]',
  '  )',
  ')',
  'RETURN {}'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return err ? false : true;
  });

};

/**
  removeAllow( roles, resources, permissions, function(err, done, query, parameters) )

  Removes the given permissions from the given roles over the given resources.

  @param {String|Array} role(s) to remove permissions from.
  @param {String|Array} resource(s) to remove permisisons from.
  @param {String|Array} permission(s) to remove from the roles over the resources.
  @param {Function} Callback called when finished.

  @return
*/
ACL.prototype.denyResourcesPermission = function(groups, resources, permissions, cb){
  var acl = this;

  var args = Args([
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permission_string: Args.STRING},
                 {permission_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);

             // Ensure args.permissions is a CoUS
             args.permissions = acl._ensureCoUS(args.permission_string, args.permission_list);


  var parameters = {
    groups: args.groups,
    resources: args.resources,
    permissions: args.permissions
  };

  var query = [
  'MATCH (group:Usergroup)',
  'WHERE group.group_name IN {groups}',
  'WITH group',
  '  MATCH (group)-[rel:HAS_PERMISSION]->(res:Resource)',
  '  WHERE res.resource_id IN {resources}',
  '  SET rel.permission_list = [str IN rel.permission_list WHERE NOT str IN {permissions}]',
  'RETURN {}'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return err ? false : true;
  });

};

/**
  allowedPermissions( userId, resources, function(err, resources, query, parameters) )

  Returns all the allowable permissions a given user have to
  access the given resources.

  It returns an array of objects where every object maps a
  resource name to a list of permissions for that resource.

  @param {String|Number} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {Function} Callback called when finished.
*/
ACL.prototype.getUserResourcesPermissions = function(user_id, resources, cb){
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);

  var parameters = {
    user: acl._serializeUser(args.user_id),
    resources: args.resources
  };

  var query = [
  'MATCH (user:User {user_id:{user}.user_id})-[:BELONGS_TO*]->(:Usergroup )-[permission:HAS_PERMISSION]->(resource:Resource )',
  'WHERE resource.resource_id IN {resources}',
  'WITH resource, permission',
  'RETURN resource.resource_id AS resource, permission.permission_list AS permissions'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return err ? false : true;
  });

};

/**
 * hasUserAllPermissionsOnResources( user_id, resources, permissions, function(err, allowed) )
 *
 * Checks if the given user is allowed to access every resource for all the given
 * permissions (note: it must fulfill all the permissions).
 *
 * @param {String|Number} userId      User id.
 * @param {String|Array}  resource(s) Resource or list of resources
 * @param {String|Array}  permissions Permission or list of permissions
 * @param {Function} Callback called with the result.
*/
ACL.prototype.hasUserAllPermissionsOnResources = function(user_id, resources, permissions, cb){
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permission_string: Args.STRING},
                 {permission_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);

             // Ensure args.resources is a CoUS
             args.permissions = acl._ensureCoUS(args.permission_string, args.permission_list);

  var parameters = {
    user: acl._serializeUser(user_id),
    resources: args.resources,
    permissions: args.permissions
  };

  var query = [
  'MATCH (user:User {user_id:{user}.user_id})-[:BELONGS_TO]->(:Usergroup )-[permissions:HAS_PERMISSION]->(resource:Resource )',
  'WHERE resource.resource_id IN {resources} AND all(str IN {permissions} WHERE str IN permissions.permission_list)',
  'RETURN resource'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return (!err && result.length === args.resources.length) ? true : false;
  });

};

/**
 * hasUserAnyPermissionsOnResources( user_id, resources, permissions, function(err, allowed) )
 *
 * Checks if the given user is allowed to access every resource with any of the given
 * permissions.
 *
 * @param {String|Number} userId      User id.
 * @param {String|Array}  resource(s) Resource or list of resources
 * @param {String|Array}  permissions Permission or list of permissions
 * @param {Function} Callback called with the result.
*/
ACL.prototype.hasUserAnyPermissionsOnResources = function(user_id, resources, permissions, cb) {
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permission_string: Args.STRING},
                 {permission_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);

             // Ensure args.resources is a CoUS
             args.permissions = acl._ensureCoUS(args.permission_string, args.permission_list);

  var parameters = {
    user: acl._serializeUser(user_id),
    resources: args.resources,
    permissions: args.permissions
  };

  var query = [
  'MATCH (user:User {user_id:{user}.user_id})-[:BELONGS_TO]->(:Usergroup )-[permissions:HAS_PERMISSION]->(resource:Resource )',
  'WHERE resource.resource_id IN {resources} AND any(str IN {permissions} WHERE str IN permissions.permission_list)',
  'RETURN resource'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return (!err && result.length === args.resources.length) ? true : false;
  });

};

/**
  areAnyRolesAllowed( roles, resource, permissions, function(err, allowed) )

  Returns true if any of the given roles have the right permissions.

  @param {String|Array} Role(s) to check the permissions for.
  @param {String} resource(s) to ask permissions for.
  @param {String|Array} asked permissions.
  @param {Function} Callback called with the result.
*/
ACL.prototype.hasAnyGroupPermissionsOnResources = function(groups, resources, permissions, cb){
  var acl = this;

  var args = Args([
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permission_string: Args.STRING},
                 {permission_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

             // Ensure args.resources is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);

             // Ensure args.resources is a CoUS
             args.permissions = acl._ensureCoUS(args.permission_string, args.permission_list);

  var parameters = {
    groups: args.groups,
    resources: args.resources,
    permissions: args.permissions
  };

  var query = [
  'MATCH (group:Usergroup )',
  'WHERE group.group_name IN {groups}',
  'WITH group',
  'MATCH (group)-[:BELONGS_TO*0..]->(:Usergroup )-[permission:HAS_PERMISSION]->(resource:Resource )',
  'WHERE resource.resource_id IN {resources} AND all(str IN {permissions} WHERE str IN permission.permission_list)',
  'RETURN group, collect(resource)'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return (!err && result.length) ? true : false;
  });

};

/**
 * getGroupsPermittedResources( groups, function(err, {resourceName: [permissions]}) )
 *
 * Returns what resources the group(s) have permissions over.
 *
 *
 * getGroupsPermittedResources( groups, permissions, function(err, {resourceName: [permissions]}) )
 *
 * Returns what resources the group(s) have the given permissions over
 *
 * @param {String|[String]}             groups        Group(s)
 * @param {String|[String]} [optional]  permissions   Permission(s)
 * @param {Function}                    cb            Callback called with the result.
 *
 * @return
 * @type {Object}
 */
ACL.prototype.getGroupsPermittedResources = function(groups, permissions, cb) {
  var acl = this;

  switch (arguments.length) {
    case 0:
      throw('acl.getGroupsPermittedResources() has the following signature: (groups [, permissions] [, callback]');
      return;
      break;

    case 2:
      cb = permissions;
      permissions = undefined;
      break;
  }

  var parameters = {
    groups: acl._ensureCoUS(groups, groups)
  };

  if (permissions) {
    parameters.permissions = acl._ensureCoUS(permissions, permissions);

    var query = [
    'MATCH (group:Usergroup )-[rel:HAS_PERMISSION]->(res:Resource )',
    'WHERE group.group_name IN {groups} AND all(p IN {permissions} WHERE p IN rel.permission_list)',
    'RETURN res.resource_id AS name, rel.permission_list AS permissions'
    ].join('\n');

  } else {

    var query = [
    'MATCH (group:Usergroup )-[rel:HAS_PERMISSION]->(res:Resource )',
    'WHERE group.group_name IN {groups}',
    'RETURN res.resource_id AS name, rel.permission_list AS permissions'
    ].join('\n');

  }


  return RichPromise(acl, query, parameters, cb, function(err, resources) {
    var ret_resources = {};
    if (! _.isArray(resources) ) {
      ret_resources[resources.name] = resources.permissions;
      return ret_resources;
    }
    var _resources = _.groupBy(resources, 'name');


    for (var k in _resources) {
      if (_resources.hasOwnProperty(k)) {
        var resource_variants = _resources[k];
        var cumulated_permissions = _.reduce(resource_variants, function(memo, res) {
          return _.union(memo, res.permissions);
        }, []);
        if (cumulated_permissions.length) ret_resources[k] = cumulated_permissions;
      }
    }

    return ret_resources;
  });

};

/**
 * getUserPermittedResource( user_id, function(err, {resourceName: [permissions]})
 *
 * Returns what resources the user has permission over
 *
 */
ACL.prototype.getUserPermittedResource = function(user_id, cb) {
  var acl = this;

  var args = Args([
               [
                 {user_id: Args.STRING | Args.Required},
                 {user_id: Args.INT    | Args.Required}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);

  var parameters = {
    user: args.user_id
  };

  var query = [
  'MATCH (user:User )-[:BELONGS_TO*]->(group:Usergroup )-[rel:HAS_PERMISSION]->(res:Resource )',
  'WHERE user.user_id = {user}',
  'RETURN res.resource_id AS name, rel.permission_list AS permissions'
  ].join('\n');

  return RichPromise(acl, query, parameters, cb, function(err, resources) {
    var _resources = _.groupBy(resources, 'name');
    var ret_resources = [];

    for (var k in _resources) {
      if (_resources.hasOwnProperty(k)) {
        var resources_variants = _resources[k];
        var tmpRes = {
          permissions: _.reduce(resources_variants, function(memo, res) {
            return _.union(memo, res.permissions);
          }, [])
        };
        tmpRes[acl.settings.res_id_key] = k;
        if (tmpRes.permissions.length) {
          ret_resources.push(tmpRes);
        }

      }
    }

    return ret_resources;
  });

};

module.exports = function(opts) {
  return new ACL(opts);
};
