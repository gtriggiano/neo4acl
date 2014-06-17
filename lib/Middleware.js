var _ = require('underscore');
var Args = require('args-js');

var _getDescendantProperty = function(obj, desc) {
    var arr = desc.split(".");
    while(arr.length && (obj = obj[arr.shift()]));
    return obj;
};

var _replaceParameters = function(resources, searchFn) {
  var paramRegex = /\{(\w+)\}/g;

  var ret = [];

  resources.forEach(function(resource) {
    var strToparse = resource;
    var tmpParam;
    var tmpValue;
    var tmpMatch;
    var replaceRegex;
    var params = {};


    while (tmpMatch = paramRegex.exec(strToparse)) {
      var tmpParam = tmpMatch[1];
      var tmpValue = searchFn(tmpParam);
      if (tmpValue && !params[tmpParam]) {
        replaceRegex = new RegExp('\{'+ tmpParam +'\}','g');
        strToparse.replace(replaceRegex, tmpValue);
        params[tmpParam] = true;
      };
    }

    ret.push(strToparse);
  });

  return ret;
};

var Middleware = function(acl) {
  this.settings = {
    user_id_path: 'user._id',
    params_fallbacks: {},
    fail_callback: function(req, res, next) {
      res.send(401, 'Unauthorized');
    }
  };
  this.acl = acl;
};

/**
 * Function that emulates req.param()
 */
Middleware.prototype._fakeReqRes = function(request, parameters, fakeSend) {
  var req = _.extend({
    url: 'home',
    method: 'get'
  }, request);
  req.param = function(name) {
    return parameters[name];
  }

  var res = {
    send: function(status, message) {
      console.log('ACL Middleware answered request with status: '+ status +' and message: '+ message);
    }
  };

  return {
    req: req,
    res: res
  }

};

/**
 * initialize( options)
 *
 * Put this middleware right after the session middlewares used by your applocation.
 * It will create the req.neo4acl object
 * and set req.neo4acl.user_id to the session user id or 'anonymous'
 *
*/
Middleware.prototype.initialize = function(options) {
  var args = Args([
                    {options: Args.OBJECT | Args.Optional,
                     _default: {}}
                  ], arguments);

  var settings = _.extend(this.settings, args.options);

  return function(req, res, next) {
    req.neo4acl = req.neo4acl || {};
    req.neo4acl.user_id = req.neo4acl.user_id ? req.neo4acl.user_id :
                          _getDescendantProperty(req, settings.user_id_path) ?
                            _getDescendantProperty(req, settings.user_id_path) : 'anonymous';
    next();
  }
};

/**
 * loadGroups()
 *
 * Returns a middleware
 * which fetches all the groups the user belongs to
 * and store them in the req.neo4acl.groups object
 *
 * If you use this middleware right after the session middlewares used by your application
 * the middlewwares returned by this methods:
 *
 *   - acl.mw.belongsToAll()
 *   - acl.mw.belongsToAny()
 *   - acl.mw.belongsToAllDirect()
 *   - acl.mw.belongsToAnyDirect()
 *
 * will look into the req.neo4acl.groups object instead of query the database
 *
 * @param {Object} options
 *
*/
Middleware.prototype.loadGroups = function() {
  var acl = this.acl;

  var args = Args([
                    {options: Args.OBJECT | Args.Optional,
                     _default: {}}
                  ], arguments);

  var settings = _.extend(this.settings, args.options);

  return function(req, res, next) {
    acl.getUserGroups(req.neo4acl.user_id, function(err, groups) {
      if (!err) {
        req.neo4acl.groups = groups;
      }
      next();
    });
  };

};

/**
 * belongsToAny( groups [, options])
 *
 * Returns a middleware
 * which checks if the user belongs to any of the passed groups
 *
 * @param {String|Array}  groups    Group(s) that the user could belong to
 * @param {Object}        options   Options
 *
 * @returns Middleware
 * @type Function
 */
Middleware.prototype.belongsToAny = function(groups, options) {
  var acl = this.acl;

  var args = Args([
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               {options: Args.OBJECT | Args.Optional,
                _default: {}}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

  var settings = _.extend(this.settings, args.options);

  return function(req, res, next) {

    // Groups not loaded. Query the graph
    if (! _.isArray(req.neo4acl.groups) ) {
      acl.isUserInAnyGroup(req.neo4acl.user_id, args.groups, function(err, bool) {
        if (bool) return next();
        return settings.fail_callback.call({}, req, res, next);
      });

    // Groups already loaded
    } else {
      var matched_groups = _.filter(req.neo4acl.groups, function(group) {
        return args.groups.indexOf(group.name) > -1;
      });
      if (matched_groups.length) return next();
      return settings.fail_callback.call({}, req, res, next);
    }

  }
};

/**
 * belongsToAll( groups [, options])
 *
 * Returns a middleware
 * which checks if the user belongs to every passed group
 *
 * @param {String|Array}  groups   Group(s) that the user must belong to
 * @param {Object}        options  Options
 *
 * @returns Middleware
 * @type Function
 */
Middleware.prototype.belongsToAll = function(groups, options) {
  var acl = this.acl;

  var args = Args([
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               {options: Args.OBJECT | Args.Optional,
                _default: {}}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

  var settings = _.extend(this.settings, args.options);

  return function(req, res, next) {

    // Groups not loaded. Query the graph
    if (! _.isArray(req.neo4acl.groups) ) {
      acl.isUserInAllGroups(req.neo4acl.user_id, args.groups, function(err, bool) {
        if (bool) return next();
        return settings.fail_callback.call({}, req, res, next);
      });

    // Groups already loaded
    } else {
      var matched_groups = _.filter(req.neo4acl.groups, function(group) {
        return args.groups.indexOf(group.name) > -1;
      });
      if (matched_groups.length === args.group.length) return next();
      return settings.fail_callback.call({}, req, res, next);
    }

  }
};

/**
 * isDirectMemberOfAllGroups( groups, [,options])
 *
 * Returns a middleware
 * which checks if the user is a direct member of every of the passed groups
 *
 * @param {String|[String]} groups  Group(s) that the user must directly belong to
 * @param {Object}          options Options
 */
Middleware.prototype.belongsToAllDirect = function(groups, options) {
  var acl = this.acl;

  var args = Args([
               [
                 {group_string: Args.STRING},
                 {group_list: Args.ARRAY}
               ],
               {options: Args.OBJECT | Args.Optional,
                _default: {}}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.groups = acl._ensureCoUS(args.group_string, args.group_list);

  var settings = _.extend(this.settings, args.options);

  return function(req, res, next) {

    // Groups not loaded. Query the graph
    if (! _.isArray(req.neo4acl.groups) ) {
      acl.isUserInAllGroups(req.neo4acl.user_id, args.groups, function(err, bool) {
        if (bool) return next();
        return settings.fail_callback.call({}, req, res, next);
      });

    // Groups already loaded
    } else {
      var matched_groups = _.filter(req.neo4acl.groups, function(group) {
        return args.groups.indexOf(group.name) > -1;
      });
      if (matched_groups.length === args.group.length) return next();
      return settings.fail_callback.call({}, req, res, next);
    }

  }

};

/**
 * isDirectMemberOfAnyGroups( groups, [,options])
 *
 * Returns a middleware
 * which checks if the user is a direct member of any of the passed groups
 *
 * @param {String|[String]} groups  Group(s) that the user could directly belong to
 * @param {Object}          options Options
 */
Middleware.prototype.belongsToAnyDirect = function(groups, options) {};

/**
 * hasAllPermissionsOnResources( [resources] [, permissions] [, options])
 *
 * Exports a middleware
 * which checks if the user has all the given permissions
 * over every given resources
 *
 * @param {String|Array} role         Resource(s) Defaults to req.url
 * @param {String|Array} permissions  Permissions(s) Defaults to req.method
 * @param {Object}       options      Options
 *
 * @returns Middleware
 * @type Function
 */
Middleware.prototype.hasAllPermissionsOnResources = function(resources, permissions, options) {
  var acl = this.acl;

  switch (arguments.length) {

  // options
  case 1:
    options = resources;
    resources = permissions = [];
    break;

  // permissions, options
  case 2:
    options = permissions;
    permissions = resources;
    resources = [];
    break;
  default:

  }

  // Ensure resources is CoUS
  resources = (_.isString(resources) || _.isArray(resources)) ?
                resources : [];
  resources = acl._ensureCoUS(resources, resources);

  // Ensure permissions is CoUS
  permissions = (_.isString(permissions) || _.isArray(permissions)) ?
                permissions : [];
  permissions = acl._ensureCoUS(permissions, permissions);

  // Ensure options is an object
  options = _.isObject(options) ? options : {};

  var settings = _.extend(this.settings, options);

  return function(req, res, next) {
    var resource_list;
    var permission_list;

    // Define the resource list
    if (! resources.length) {
      resource_list = req.url;
    } else {
      resource_list = _replaceParameters(resources, req.param);
      resource_list = _replaceParameters(resource_list, function(param) {
        return settings.params_fallbacks[param];
      });
    }

    // Define the permission list
    var permission_list = permissions.length ? permissions : req.method;

    acl.hasUserAllPermissionsOnResources(req.neo4acl.user_id, resource_list, permission_list, function(err, allowed) {
      if (allowed) return next();
      return settings.fail_callback.call({}, req, res, next);
    });
  }

};

/**
 * hasAnyPermissionsOnResources( [resources] [, permissions] [, options])
 *
 * Exports a middleware
 * which checks, for each given resource, if the user has any of the listed permissions
 * (note: it must fullfill all the checks
 *
 * @param {String|Array} role         Resource(s) Defaults to req.url
 * @param {String|Array} permissions  Permissions(s) Defaults to req.method
 * @param {Object}       options      Options
 *
 * @returns Middleware
 * @type Function
 */
Middleware.prototype.hasAnyPermissionsOnResources = function(resources, permissions, options) {
  var acl = this.acl;

  switch (arguments.length) {

  // options
  case 1:
    options = resources;
    resources = permissions = [];
    break;

  // permissions, options
  case 2:
    options = permissions;
    permissions = resources;
    resources = [];
    break;
  default:

  }

  // Ensure resources is CoUS
  resources = (_.isString(resources) || _.isArray(resources)) ?
                resources : [];
  resources = acl._ensureCoUS(resources, resources);

  // Ensure permissions is CoUS
  permissions = (_.isString(permissions) || _.isArray(permissions)) ?
                permissions : [];
  permissions = acl._ensureCoUS(permissions, permissions);

  // Ensure options is an object
  options = _.isObject(options) ? options : {};

  var settings = _.extend(this.settings, options);

  return function(req, res, next) {
    var resource_list;
    var permission_list;

    // Define the resource list
    if (! resources.length) {
      resource_list = req.url;
    } else {
      resource_list = _replaceParameters(resources, req.param);
      resource_list = _replaceParameters(resource_list, function(param) {
        return settings.params_fallbacks[param];
      });
    }

    // Define the permission list
    var permission_list = permissions.length ? permissions : req.method;

    acl.hasUserAnyPermissionsOnResources(req.neo4acl.user_id, resource_list, permission_list, function(err, allowed) {
      if (allowed) return next();
      return settings.fail_callback.call({}, req, res, next);
    });
  }

};

module.exports = function(acl) {

  return new Middleware(acl);

};
