var _ = require('underscore');
var seraph = require('seraph');
var Args = require('args-js');
Args.noop = function () {};

var Bucket = require('./Bucket');
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
  res_id_key: new RegExp('res_id', 'g'),
  belongs: new RegExp('BELONGS_TO', 'g'),
  belongs_since_key: new RegExp('belongs_since', 'g'),
  has_permission: new RegExp('HAS_PERMISSION', 'g'),
  has_permission_list_key: new RegExp('perm_list', 'g')
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
  this.middleware = Middleware(this);
  this.models = require('./models.js')(this.db, this.settings);
  
};

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
ACL.prototype._serializeUser = function(userId) {
  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ]
             ], arguments);
  
  var ret = {};
  ret[this.settings.user_id_key] = args.userId;
  return ret;
}; //OK

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
ACL.prototype._serializeUsergroup = function(groupName) {
  var args = Args([
               {groupName: Args.STRING | Args.Required}
             ], arguments);
             
  var ret = {};
  ret[this.settings.group_name_key] = args.groupName;
  return ret;
}; //OK

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
ACL.prototype._serializeResource = function(resourceId) {
  var args = Args([
               {resourceId: Args.STRING | Args.Required}
             ], arguments);
             
  var ret = {};
  ret[this.settings.res_id_key] = args.resourceId;
  return ret;
}; //OK

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
ACL.prototype._serializePermission = function(list) {
  var ret = {};
  ret[this.settings.has_permission_list_key] = list;
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
} // OK

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
ACL.prototype.addUserRoles = function(userId, roles, cb) {
  var acl = this;

  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               [
                 {role_string: Args.STRING},
                 {role_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);
             
             // Ensure args.roles is a CoUS
             args.roles = acl._ensureCoUS(args.role_string, args.role_list);

  
  var parameters = {
    user: acl._serializeUser(args.userId),
    groups: args.roles
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
  
} //OK

/**
  removeUserRoles( userId, roles, function(err, done) )

  Remove roles from a given user.

  @param {String|Number} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
ACL.prototype.removeUserRoles = function(userId, roles, cb){
  var acl = this;

  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               [
                 {roles: Args.STRING},
                 {roles: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);
             
             // Ensure args.roles is a CoUS
             args.roles = acl._ensureCoUS(args.role_string, args.role_list);
  
  var parameters = {
    user: acl._serializeUser(args.userId),
    groups: args.roles
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

}; //OK

/**
 * userRoles( userId, function(err, roles, query, parameters) )
 *
 * Return all the roles from a given user.
 * roles = [{
 *            name: String,
 *            distance: Number
 *          }]
 *
 * @param {String|Number} User id.
 * @param {Function} Callback called when finished.
 * @return
*/
ACL.prototype.userRoles = function(userId, cb){
  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
  var acl = this;

  var parameters = {
    user: acl._serializeUser(args.userId)
  };

  var query = [
  'MATCH p = allShortestPaths((user:User {user_id:{user}.user_id})-[:BELONGS_TO*]->(group:Usergroup ))',
  'RETURN DISTINCT group.name AS name, length(p) AS distance'
  ].join('\n');
  
  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return result;
  });

}; //OK

/**
 * userHasAllRoles( userId, roles, function(err, has, query, parameters) )
 *
 * Checks if the user has each of the listed roles
 *
 * @param {String|Number} User id.
 * @param {Function} Callback called when finished.
 * @return
*/
ACL.prototype.userHasAllRoles = function(userId, roles, cb) {
  var acl = this;
  var promise = {};

  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               [
                 {role_string: Args.STRING},
                 {role_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);
             
             // Ensure args.roles is a CoUS
             args.roles = acl._ensureCoUS(args.role_string, args.role_list);
             
  var parameters = {
    user: acl._serializeUser(args.userId),
    groups: args.roles
  };

  var query = [
  'MATCH (user:User {user_id:{user}.user_id})-[:BELONGS_TO*]->(group:Usergroup )',
  'WHERE group.group_name IN {groups}',
  'RETURN count(DISTINCT group.group_name) AS total'
  ].join('\n');
  
  return RichPromise(acl, query, parameters, cb, function(err, result) {
    return result.total === args.roles.length;
  });
  
}; // OK

/**
 * userHasAnyRole( userId, roles, function(err, bool, query, parameters) )
 *
 * Checks if the user has any of the passed roles
 *
 * @param {String|Number} User id.
 * @param {Function} Callback called when finished.
 * @return
*/
ACL.prototype.userHasAnyRole = function(userId, roles, cb) {
  var acl = this;
  
  var userHasAllRoles = acl.userHasAllRoles(userId, roles);
  
  return RichPromise(acl, userHasAllRoles.originalQuery, userHasAllRoles.parameters, cb, function(err, result) {
    return result.total > 0;
  });

};

/**
 * addRoleParents(role, parents, function(err, role, parents, query, parameters) )
 *
 * Adds a parent or parent list to role.
 *
 * @param {String} role Role to wich add the parents
 * @param {String|Array} parents Parent role(s) to add to role
 * @param {Function} Callback called when finished.
 *
 * @return
*/
ACL.prototype.addRoleParents = function(role, parents, cb){
  var acl = this;

  var args = Args([
               {role: Args.STRING | Args.Required},
               [
                 {parent_string: Args.STRING},
                 {parents_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);
             
             // Ensure args.parents is CoUS
             args.parents = acl._ensureCoUS(args.parent_string, args.parent_list);
  


  var parameters = {
    group: acl._serializeUsergroup(args.role)
  };
  
  var bucket = Bucket();
  
  /*
  MERGE (group:Usergroup {name:{group}.name})
  MERGE (group0:Usergroup {name:{group0}.name})
  MERGE (group)-[rel0:BELONGS_TO]->(group0)
  MERGE (group1:Usergroup {name:{group1}.name})
  MERGE (group)-[rel1:BELONGS_TO]->(group1)
  RETURN group
  */
  var query = [
  'MERGE (group:Usergroup {'+ acl.settings.group_name_key +':{group}.'+ acl.settings.group_name_key +'})'
  ];
  
  args.parents.forEach(function(p, i) {
    
    var labelsN = acl._getNumberedLabels(i);
    
    bucket('parents').add(labelsN.group);
    
    parameters[labelsN.group] = acl._serializeUsergroup(p);
    query.push('MERGE ('+labelsN.group+':'+ acl.settings.group_label +' {'+ acl.settings.group_name_key +':{'+labelsN.group+'}.'+ acl.settings.group_name_key +'})');
    query.push('MERGE (group)-['+labelsN.rel+':BELONGS_TO]->('+labelsN.group+')');
  });
  
  query.push('RETURN group, ['+ bucket('parents').output(',') +'] AS parents');
  query = query.join('\n');
  
  if (cb) {
    acl.db.query(query, parameters, function(err, results) {
      cb(err, results[0] && results[0].group, results[0] && results[0].parents, query, parameters);
    });
  }

}; //OK

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
ACL.prototype.removeRole = function(role, cb){
  var args = Args([
               {role: Args.STRING | Args.Required},
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
  var acl = this;
  
  var parameters = {
    group: acl._serializeUsergroup(args.role)
  };
  
  /*
  MATCH (group:Usergroup {name:{group}.name})
  OPTIONAL MATCH (group)-[rels]-()
  DELETE rels, group
  */
  var query = [
  'MATCH (group:'+ acl.settings.group_label +' {'+ acl.settings.group_name_key +':{group}.'+ acl.settings.group_name_key +'})',
  'OPTIONAL MATCH (group)-[rels]-()',
  'DELETE rels, group',
  ];
  
  query = query.join('\n');
  
  acl.db.query(query, parameters, function(err, result) {
    var done = err ? false : true;
    cb(err, done, query, parameters);
  });
  
}; //OK

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
ACL.prototype.removeResource = function(resourceId, cb){
  var args = Args([
               {resourceId: Args.STRING | Args.Required},
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);

  var acl = this;
  
  var parameters = {
    res: acl._serializeResource(resourceId)
  };
  
  /*
  MATCH (res:Resource {_id:{res}._id})
  OPTIONAL MATCH (res)-[rels]-()
  DELETE rels, res
  */
  var query = [
  'MATCH (res:'+ acl.settings.res_label+' {'+ acl.settings.res_id_key +':{res}.'+ acl.settings.res_id_key +'})',
  'OPTIONAL MATCH (res)-[rels]-()',
  'DELETE rels, res'
  ];
  
  query = query.join('\n');
  
  acl.db.query(query, parameters, function(err, result) {
    var done = err ? false : true;
    cb(err, done, query, parameters);
  });
  
}; // OK

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
ACL.prototype.allow = function(roles, resources, permissions, cb){
  var acl = this;
  
  var args = Args([
               [
                 {role_string: Args.STRING},
                 {role_list: Args.ARRAY}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permission_string: Args.STRING},
                 {permission_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
             // Ensure args.roles is a CoUS
             args.roles = acl._ensureCoUS(args.role_string, args.role_list);
             
             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);
             
             // Ensure args.roles is a CoUS
             args.permissions = acl._ensureCoUS(args.permission_string, args.permission_list);
  

  var parameters = {};
  
  /*
  MERGE (group0:Usergroup {name:{group0}.name})
  MERGE (group1:Usergroup {name:{group1}.name})
  
  MERGE (res0:Resource {_id:{res0}._id})
  MERGE (res1:Resource {_id:{res1}._id})
  
  MERGE (group0)-[relgroup0res0:HAS_PERMISSION]->(res0)
    ON CREATE SET relgroup0res0.list = {relgroup0res0}.list
    ON MATCH SET relgroup0res0.list = relgroup0res0.list + [str IN {relgroup0res0}.list WHERE NOT str IN relgroup0res0.list]
  
  RETURN {}
  */
  var query = [];
  
  // Iterate resources and merge them
  args.resources.forEach(function(resource, i) {
    var labelsN = acl._getNumberedLabels(i);
    parameters[labelsN.res] = acl._serializeResource(resource);
    
    query.push('MERGE ('+ labelsN.res +':'+ acl.settings.res_label +' {'+ acl.settings.res_id_key +':{'+ labelsN.res +'}.'+ acl.settings.res_id_key+'})');
  });
  
  // Iterate roles, merge them, and give permissions to resources
  args.roles.forEach(function(role, i) {
    var labelsN = acl._getNumberedLabels(i);
    
    parameters[labelsN.group] = acl._serializeUsergroup(role);
    
    var serializedPermissions = acl._serializePermission(args.permissions);
    
    query.push('MERGE ('+ labelsN.group +':'+ acl.settings.group_label +' {'+ acl.settings.group_name_key +':{'+ labelsN.group +'}.'+ acl.settings.group_name_key+'})');
    
    args.resources.forEach(function(resource, l) {
      var labelsNRes = acl._getNumberedLabels(l);
      var labelsNRel = 'rel' + labelsN.group + labelsNRes.res;
      
      parameters[labelsNRel] = serializedPermissions;
      
      query.push('MERGE ('+ labelsN.group +')-['+ labelsNRel +':'+ acl.settings.has_permission +']->('+ labelsNRes.res +')');
      query.push('  ON CREATE SET '+ labelsNRel +'.'+ acl.settings.has_permission_list_key +' = {'+ labelsNRel +'}.'+ acl.settings.has_permission_list_key +'');
      query.push('  ON MATCH SET '+ labelsNRel +'.'+ acl.settings.has_permission_list_key +' = '+ labelsNRel +'.'+ acl.settings.has_permission_list_key +' + [str IN {'+ labelsNRel +'}.'+ acl.settings.has_permission_list_key +' WHERE NOT str IN '+ labelsNRel +'.'+ acl.settings.has_permission_list_key +']');
    });
    
  });
  
  query.push('RETURN {}');
  query = query.join('\n');
  
  acl.db.query(query, parameters, function(err, result) {
    var done = result[0] ? true : false;
    cb(err, done, query, parameters);
  });
}; // OK

/**
  removeAllow( roles, resources, permissions, function(err, done, query, parameters) )

  Removes the given permissions from the given roles over the given resources.

  @param {String|Array} role(s) to remove permissions from.
  @param {String|Array} resource(s) to remove permisisons from.
  @param {String|Array} permission(s) to remove from the roles over the resources.
  @param {Function} Callback called when finished.

  @return
*/
ACL.prototype.removeAllow = function(role, resources, permissions, cb){
  var acl = this;
  
  var args = Args([
               [
                 {role_string: Args.STRING},
                 {role_list: Args.ARRAY}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permission_string: Args.STRING},
                 {permission_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
             // Ensure args.roles is a CoUS
             args.roles = acl._ensureCoUS(args.role_string, args.role_list);
             
             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);
             
             // Ensure args.permissions is a CoUS
             args.permissions = acl._ensureCoUS(args.permission_string, args.permission_list);
  

  var parameters = {
    groups: args.roles
  };
  
  /*
  MATCH (group:Usergroup)
  WHERE group.name IN {groups}
  WITH group
    MATCH (group)-[relgroupres0:HAS_PERMISSION]->(res0:Resource {_id:{res0}._id})
    SET relgroupres0.list = [str IN relgroupres0.list WHERE NOT str IN {relgroupres0}.list]
  */
  var query = [
  'MATCH (group:'+ acl.settings.group_label +')',
  'WHERE group.name IN {groups}',
  'WITH group'
  ];
  
  args.resources.forEach(function(resource, i) {
    var labelsN = acl._getNumberedLabels(i);
    var relId = 'rel'+ labelsN.res;
    
    parameters[labelsN.res] = acl._serializeResource(resource);
    parameters[relId] = acl._serializePermission(args.permissions);
    
    query.push('MATCH (group)-['+ relId +':'+ acl.settings.has_permission +']->('+ labelsN.res +':'+ acl.settings.res_label +' {'+ acl.settings.res_id_key +':{'+ labelsN.res +'}.'+ acl.settings.res_id_key +'})');
    query.push('SET '+ relId +'.'+ acl.settings.has_permission_list_key +' = [str IN '+ relId +'.'+ acl.settings.has_permission_list_key +' WHERE NOT str IN {'+ relId +'}.'+ acl.settings.has_permission_list_key +']')
    
  });
  
  query.push('RETURN group');
  query = query.join('\n');
  
  acl.db.query(query, parameters, function(err, res) {
    var done = err ? false : true;
    cb(err, res, done, parameters);
  });
  
}; // Ok

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
ACL.prototype.allowedPermissions = function(userId, resources, cb){
  var acl = this;
  
  var promise = {};
  
  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional}
             ], arguments);
             
             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);
             
  var user = acl._serializeUser(args.userId);
  
  var parameters = {
    user: user,
    resources: args.resources
  };
  
  /*
  MATCH (user:User {_id:{user}._id})-[:BELONGS_TO*]->(:Usergroup)-[permission:HAS_PERMISSION]->(res:Resource)
  WHERE res._id IN {resources}
  WITH res, permission
  RETURN res._id AS resource, permission.list AS permissions
  */
  var query = [
  'MATCH (user:'+ acl.settings.user_label +' {'+ acl.settings.user_id_key +':{user}.'+ acl.settings.user_id_key +'})-[:BELONGS_TO*]->(:Usergroup)-[permission:HAS_PERMISSION]->(res:Resource)',
  'WHERE res.'+ acl.settings.res_id_key +' IN {resources}',
  'WITH res, permission',
  'RETURN res.'+ acl.settings.res_id_key +' AS id, permission.list AS permissions',
  ];
  
  query = query.join('\n');
  
  promise.query = query;
  promise.parameters = parameters;
  
  if (cb) {
    acl.db.query(query, parameters, function(err, results) {
      var ress = {};
    
      results.forEach(function(res) {
        ress[res.id] = ress[res.id] ? _.union(ress[res.id], res.permissions) : res.permissions;
      });
    
      var resources = [];
      _(ress).each(function(list, id) {
        resources.push({
          name: id,
          permissions: list
        });
      });
    
      cb(err, resources, query, parameters);
    });
  }
  
  return promise;
}; // OK

/**
  isAllowed( userId, resource, permissions, function(err, allowed) )

  Checks if the given user is allowed to access the resource for the given
  permissions (note: it must fulfill all the permissions).

  @param {String|Number} userId User id.
  @param {String|Array}  resource(s) to ask permissions for.
  @param {String|Array}  permissions Asked permissions.
  @param {Function} Callback called with the result.
*/
ACL.prototype.isAllowed = function(userId, resource, permissions, cb){
  var promise = {};
  var acl = this;
  
  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               [
                 {resource_string: Args.STRING},
                 {resource_list: Args.ARRAY}
               ],
               [
                 {permissions_string: Args.STRING},
                 {permissions_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
             // Ensure args.resources is a CoUS
             args.resources = acl._ensureCoUS(args.resource_string, args.resource_list);
             
             // Ensure args.resources is a CoUS
             args.permissions = acl._ensureCoUS(args.permissions_string, args.permissions_list);
  
  var parameters = {
    user: acl._serializeUser(userId),
    resources: args.resources,
    permissions: args.permissions
  };
         
  /*
  MATCH (user:User {_id:{user}._id})-[:BELONGS_TO*]->(:Usergroup)-[permission:HAS_PERMISSION]->(res:Resource)
  WHERE res._id IN {resources} AND all(str IN {permissions} WHERE str IN permission.list) 
  RETURN res
  */
  var query = [
  'MATCH (user:'+ acl.settings.user_label +' {'+ acl.settings.user_id_key +':{user}.'+ acl.settings.user_id_key +'})-[:BELONGS_TO*]->(:'+ acl.settings.group_label +')-[permission:'+ acl.settings.has_permission +']->(res:'+ acl.settings.res_label +')',
  'WHERE res.'+ acl.settings.res_id_key +' IN {resources} AND all(str IN {permissions} WHERE str IN permission.list)',
  'RETURN res'
  ];
  query = query.join('\n');
  
  if (cb) {
    acl.db.query(query, parameters, function(err, res) {
      var allowed = false;
      if (res.length === args.resources.length) allowed = true;
      cb(err, allowed, query, parameters);      
    });
  }
  
  promise.query = query;
  promise.parameters = parameters;
  return promise;
  
}; // OK

/**
  areAnyRolesAllowed( roles, resource, permissions, function(err, allowed) )

  Returns true if any of the given roles have the right permissions.

  @param {String|Array} Role(s) to check the permissions for.
  @param {String} resource(s) to ask permissions for.
  @param {String|Array} asked permissions.
  @param {Function} Callback called with the result.
*/
ACL.prototype.areAnyRolesAllowed = function(roles, resource, permissions, cb){
  contract(arguments)
    .params('string|array', 'string', 'string|array', 'function')
    .params('string|array', 'string', 'string|array')
    .end();

  roles = makeArray(roles);
  permissions = makeArray(permissions);

  if(roles.length===0){
    return bluebird.resolve(false).nodeify(cb);
  }else{
    return this._checkPermissions(roles, resource, permissions).nodeify(cb);
  }
};

/**
  whatResources(role, function(err, {resourceName: [permissions]})

  Returns what resources a given role or roles have permissions over.

  whatResources(role, permissions, function(err, resources) )

  Returns what resources a role has the given permissions over.

  @param {String|Array} Roles
  @param {String[Array} Permissions
  @param {Function} Callback called wish the result.
*/
ACL.prototype.whatResources = function(roles, permissions, cb){
  contract(arguments)
    .params('string|array')
    .params('string|array','string|array')
    .params('string|array','function')
    .params('string|array','string|array','function')
    .end();

  roles = makeArray(roles);
  if (_.isFunction(permissions)){
    cb = permissions;
    permissions = undefined;
  }else if(permissions){
    permissions = makeArray(permissions);
  }

  return this.permittedResources(roles, permissions, cb);
};

ACL.prototype.permittedResources = function(roles, permissions, cb){
  var _this = this;
  var result = _.isUndefined(permissions) ? {} : [];
  return this._rolesResources(roles).then(function(resources){
    return bluebird.all(resources.map(function(resource){
      return _this._resourcePermissions(roles, resource).then(function(p){  
        if(permissions){
          var commonPermissions = _.intersection(permissions, p);
          if(commonPermissions.length>0){
            result.push(resource);
          }
        }else{
          result[resource] = p;
        }
      });
    })).then(function(){
      return result;
    });
  }).nodeify(cb);
}

module.exports = function(opts) {
  return new ACL(opts);
};
