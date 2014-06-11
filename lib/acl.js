var _ = require('underscore');
var seraph = require('seraph');
var Args = require('args-js');
    Args.noop = function(){};

var Bucket = require('./helpers/bucket');

/**
 * Neo4acl class
 * @author giacomotriggiano
 */
var ACL = function(opts) {
  var defaultSettings = {
    url: process.env.NEO4J_URL || 'http://localhost:7474',
    user_label: 'User',
    user_id_key: '_id',
    group_label: 'Usergroup',
    group_name_key: 'name',
    belongs: 'BELONGS_TO',
    permissions: 'HAS_PERMISSION'
  };
  this.settings = _.extend({}, defaultSettings, opts);
  this.db = seraph(this.settings.url);
  this.models = require('./models.js')(this.db, this.settings);
  
};

/**
 * Given a user id returns an object useful to be
 * used as parameter in a cypher query
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
 * used as parameter in a cypher query
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
    rel: 'rel'+ args.num
  }
}; //OK

/**
 * addUserRoles( userId, roles, function(err) )
 *
 * Adds roles to a given user id.
 *
 * @param {String|Number} User id.
 * @param {String|Array} Role(s) to add to the user id.
 * @param {Function} Callback called when finished.
 * @return
*/
ACL.prototype.addUserRoles = function(userId, roles, cb) {
  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               [
                 {roles: Args.STRING | Args.Required},
                 {roles: Args.ARRAY | Args.Required,
                  _check: function(roles) {
                    var flag = true;
                    roles.forEach(function(role) {
                      if (!flag) return;
                      flag = _.isString(role);
                    });
                    return flag;
                  }}
               ],
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
  var acl = this;
  
  var user = acl._serializeUser(args.userId);
  
  var parameters = {
    user: user
  };
  
  /*
  MATCH (user:User {_id:'c7d8222c9435bbeaacd17109f3a5fedb'})
  WITH collect(user) AS users
  FOREACH (u IN users |
  	MERGE (group0:Usergroup {name:'mio'})
  	MERGE (group1:Usergroup {name:'ciao'})
  	MERGE (u)-[rel0:BELONGS_TO]->(group0)
  	MERGE (u)-[rel1:BELONGS_TO]->(group1)
  )
  RETURN length(users)
  */
  var query = [
  'MATCH (user:'+ acl.settings.user_label +' {'+ acl.settings.user_id_key+': {user}.'+ acl.settings.user_id_key +'})',
  'WITH COLLECT(user) AS users',
  'FOREACH (u IN users |'
  ];
  
  args.roles.forEach(function(role, i) {
    var labelsN = acl._getNumberedLabels(i);
    query.push('MERGE ('+ labelsN.group +':'+ acl.settings.group_label +' {'+ acl.settings.group_name_key+':\''+ role +'\'})');
    query.push('MERGE (u)-['+ labelsN.rel +':'+ acl.settings.belongs +']->('+ labelsN.group +')');
  });
  
  query.push(')');
  query.push('RETURN length(users) AS ok');
  query = query.join('\n');
  
  acl.db.query(query, parameters, function(err, res) {
    res = res.ok ? true : false;
    cb(err, res, query, parameters);
  });
  
} //OK

/**
  removeUserRoles( userId, roles, function(err) )

  Remove roles from a given user.

  @param {String|Number} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
ACL.prototype.removeUserRoles = function(userId, roles, cb){
  var args = Args([
               [
                 {userId: Args.STRING | Args.Required},
                 {userId: Args.INT    | Args.Required}
               ],
               [
                 {roles: Args.STRING | Args.Required},
                 {roles: Args.ARRAY | Args.Required,
                  _check: function(roles) {
                    var flag = true;
                    roles.forEach(function(role) {
                      if (!flag) return;
                      flag = _.isString(role);
                    });
                    return flag;
                  }}
               ],
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
  var acl = this;
  
  var user = acl._serializeUser(args.userId);
  
  var parameters = {
    user: user
  };
  
  /*
  MATCH (user:User {_id:'c7d8222c9435bbeaacd17109f3a5fedb'})
  OPTIONAL MATCH (user)-[rel0:BELONGS_TO]->(group0:Usergroup {name:'role'})
  DELETE rel0
  RETURN user
  */
  var query = [
  'MATCH (user:'+ acl.settings.user_label +' {'+ acl.settings.user_id_key+': {user}.'+ acl.settings.user_id_key +'})'
  ];
  
  args.roles.forEach(function(role, i) {
    var labelsN = acl._getNumberedLabels(i);
    parameters[labelsN.group] = {name: role};
    query.push('OPTIONAL MATCH (user)-['+ labelsN.rel +':'+ acl.settings.belongs +']->('+ labelsN.group +':'+ acl.settings.group_label +' {'+ acl.settings.group_name_key +':{'+ labelsN.group +'}.name})');
    query.push('DELETE '+ labelsN.rel);
  });
  
  query.push('RETURN user');
  query = query.join('\n');
  
  acl.db.query(query, parameters, function(err, res) {
    res = res && res.ok ? true : false;
    cb(err, res, query, parameters);
  });
}; //OK

/**
 * userRoles( userId, function(err, roles) )
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
  
  var user = acl._serializeUser(args.userId);
  
  var parameters = {
    user: user
  };
  
  /*
  MATCH (user:User {_id: {user}._id})-[rel:BELONGS_TO*]->(group:Usergroup)
  RETURN DISTINCT group.name AS name, length(rel) AS distance
  */
  var query = [
  'MATCH (user:'+ acl.settings.user_label +' {'+ acl.settings.user_id_key +': {user}._id} )-[rel:'+ acl.settings.belongs +'*]->(group:'+ acl.settings.group_label +')',
  'RETURN DISTINCT group.'+ acl.settings.group_name_key +' AS name, length(rel) AS distance'
  ].join('\n');
  
  acl.db.query(query, parameters, function(err, results) {
    cb(err, results, query, parameters);
  });
}; //OK

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
  var args = Args([
               {role: Args.STRING | Args.Required},
               [
                 {parent_string: Args.STRING},
                 {parents_list: Args.ARRAY}
               ],
               {cb: Args.FUNCTION | Args.Optional,
                _default: Args.noop}
             ], arguments);
             
             // Ensure args.parents is a list of unique strings
             args.parents = args.parent_s ? [args.parent_string] :
                            args.parents_list ? args.parents_list : [];
             args.parents = _(args.parents).filter(function(p) {
               return _.isString(p);
             });
             args.parents = _.uniq(args.parents);
  
  var acl = this;

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
  
  acl.db.query(query, parameters, function(err, results) {
    cb(err, results[0] && results[0].group, results[0] && results[0].parents, query, parameters);
  });
}; //OK

/**
  removeRole( role, function(err) )

  Removes a role from the system.

  @param {String} Role to be removed
  @param {Function} Callback called when finished.
*/
ACL.prototype.removeRole = function(role, cb){
  var acl = this;
  
  var params = {
    group: acl.serializeUsergroup(role)
  };
  
  var cypher = [
  'OPTIONAL MATCH (group:'+ acl.settings.group_label +' {group})-[rels]-()',
  'DELETE group, rels'
  ].join('\n');
  
  acl.db.query(cypher, params, function(err) {
    if (err) {return cb(err); }
    cb(null);
  });
  
};

/**
  removeResource( resource, function(err) )

  Removes a resource from the system

  @param {String} Resource to be removed
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
ACL.prototype.removeResource = function(resource, cb){
  contract(arguments)
    .params('string', 'function')
    .params('string')
    .end();

  var _this = this;
  return this.backend.getAsync('meta', 'roles').then(function(roles){
    var transaction = _this.backend.begin();
    _this.backend.del(transaction, allowsBucket(resource), roles);
    roles.forEach(function(role){
      _this.backend.remove(transaction, 'resources', role, resource);
    })
    return _this.backend.endAsync(transaction);
  }).nodeify(cb)
};

/**
  allow( roles, resources, permissions, function(err) )

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

  
};


ACL.prototype.removeAllow = function(role, resources, permissions, cb){
  contract(arguments)
    .params('string','string|array','string|array','function')
    .params('string','string|array','string|array')
    .params('string','string|array','function')
    .params('string','string|array')
    .end();
    
    resources = makeArray(resources);
    if(cb){
      permissions = makeArray(permissions);
    }else{
      cb = permissions;
      permissions = null;
    }
 
  return this.removePermissions(role, resources, permissions, cb);
}

/**
  removePermissions( role, resources, permissions)

  Remove permissions from the given roles owned by the given role.

  Note: we loose atomicity when removing empty role_resources.

  @param {String}
  @param {String|Array}
  @param {String|Array}
*/
ACL.prototype.removePermissions = function(role, resources, permissions, cb){

  var _this = this;

  var transaction = _this.backend.begin();
  resources.forEach(function(resource){
    var bucket = allowsBucket(resource);
    if(permissions){
      _this.backend.remove(transaction, bucket, role, permissions);
    }else{
      _this.backend.del(transaction, bucket, role);
      _this.backend.remove(transaction, 'resources', role, resource);
    }
  });

  // Remove resource from role if no rights for that role exists.
  // Not fully atomic...
  return _this.backend.endAsync(transaction).then(function(){
    var transaction = _this.backend.begin();
    return bluebird.all(resources.map(function(resource){
      var bucket = allowsBucket(resource);
      return _this.backend.getAsync(bucket, role).then(function(permissions){
        if(permissions.length==0){
          _this.backend.remove(transaction, 'resources', role, resource);
        }
      });
    })).then(function(){
      return _this.backend.endAsync(transaction);
    });
  }).nodeify(cb);
};

/**
  allowedPermissions( userId, resources, function(err, obj) )

  Returns all the allowable permissions a given user have to
  access the given resources.

  It returns an array of objects where every object maps a
  resource name to a list of permissions for that resource.

  @param {String|Number} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {Function} Callback called when finished.
*/
ACL.prototype.allowedPermissions = function(userId, resources, cb){
  contract(arguments)
    .params('string|number', 'string|array', 'function')
    .params('string|number', 'string|array')
    .end();

  var _this = this;
  resources = makeArray(resources);

  return _this.userRoles(userId).then(function(roles){
    var result = {};
    return bluebird.all(resources.map(function(resource){
      return _this._resourcePermissions(roles, resource).then(function(permissions){
        result[resource] = permissions;
      });
    })).then(function(){
      return result;
    });
  }).nodeify(cb);
};

/**
  isAllowed( userId, resource, permissions, function(err, allowed) )

  Checks if the given user is allowed to access the resource for the given
  permissions (note: it must fulfill all the permissions).

  @param {String|Number} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {String|Array} asked permissions.
  @param {Function} Callback called wish the result.
*/
ACL.prototype.isAllowed = function(userId, resource, permissions, cb){
  contract(arguments)
    .params('string|number', 'string', 'string|array', 'function')
    .params('string|number', 'string', 'string|array')
    .end();

  var _this = this;

  return this.backend.getAsync('users', userId).then(function(roles){
    if(roles.length){
      return _this.areAnyRolesAllowed(roles, resource, permissions);
    }else{
      return false;
    }
  }).nodeify(cb);
};

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