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

var _groupsInUsergroups = function(usergroups, groups, logic, direct) {
  direct = direct === true ? true : false;

  var ret;
  var responding_groups = _.filter(usergroups, function(group) {
    var condition = groups.indexOf(group) > -1;
    if (direct) {condition = (condtion && group.distance === 1)}
    return condition;
  });
  switch (logic) {
    case 'all':
      ret = (responding_groups.length === groups.length);
      break;
    case 'any':
      ret = (responding_groups.length > 0);
      break;
  }

  return ;
}

/**
 * Middleware Class
 */
var Middleware = function(acl) {
  this.settings = {
    user_id_path: 'user.' + acl.settings.user_id_key,
    params_fallbacks: {},
    anonymous_id: 'anonymous',
    on_fail: function(req, res, next) {
      res.send(401, 'Unauthorized');
    },
    on_success: function(req, res, next) {
      next();
    }
  };
  this.acl = acl;
};

/**
 * initialize([options])
 *
 * Put this middleware right after the session middlewares used by your application.
 *
 * You can provide a configuration object to it, with any of the following properties:
 *
 * options = {
 *
 *   user_id_path: 'user._id'   The dot notation path, starting from the req object,
 *                              that should lead to the user 'id' value.
 *                              Default: 'user.' + acl.settings.user_id_key
 *
 *   anonymous_id: 'anonymous'  The user id neo4acl will use if not able to find one.
 *                              Default: 'anonymous'
 *
 *   god_admin_group: String    If you provide a string here, neo4acl will query the groups that the user
 *                              belongs to (and store them into req.neo4acl.groups).
 *                              If the user belongs to a group with a name equal to the string you provided,
 *                              then she is marked as "god admin"
 *                              and every following neo4acl middleware will be unlocked
 *
 *   header_tunnel: String      This parameter is useful if you want to test your endpoint with
 *                              tools like postman
 *                              leaving the acl middlewares in place.
 *
 *                              If you provide a string here, all HTTP requests with an header equal to
 *
 *                              X-Neo4acl-tunnel: yourgtring
 *
 *                              will set neo4acl.god_admin = true and succeed to pass all the acl middlewares.
 *
 * }
 *
 * @param {object} Middleware configuration
 *
 * @return Connect/Express middleware
 * @type {Function}
*/
Middleware.prototype.initialize = function(options) {
  var mw = this;
  var args = Args([
                    {options: Args.OBJECT | Args.Optional,
                     _default: {}}
                  ], arguments);

  var settings = _.extend({}, this.settings, args.options);

  return function(req, res, next) {
    req.neo4acl = req.neo4acl || {};
    req.neo4acl.user_id = req.neo4acl.user_id ? req.neo4acl.user_id :
                          _getDescendantProperty(req, settings.user_id_path) ?
                            _getDescendantProperty(req, settings.user_id_path) : settings.anonymous_id;

    if (settings.header_tunnel && req.header('X-Neo4acl-tunnel') === settings.header_tunnel) {
      req.neo4acl.god_admin = true;
    }

    if (_.isString(settings.god_admin_group)) {
      mw.loadGroups()(req, res, function() {
        req.neo4acl.god_admin = req.neo4acl.god_admin || _groupsInUsergroups(req.neo4acl.groups, [settings.god_admin_group], 'all');
        next();
      });
    } else {
      next();
    }

  }
};

/**
 * loadGroups()
 *
 * Returns a middleware
 * that fetches all the groups the user belongs to
 * and store them in the req.neo4acl.groups property
 *
 * IF you use this middleware right after app.use(acl.mw.initialize())
 * THEN theese middlewares:
 *
 *   - acl.mw.belongsToAll()
 *   - acl.mw.belongsToAny()
 *   - acl.mw.belongsToAllDirect()
 *   - acl.mw.belongsToAnyDirect()
 *
 * will look into the req.neo4acl.groups object instead of query the database
 *
 * @return Connect/Express middleware
 * @type {Function}
*/
Middleware.prototype.loadGroups = function() {
  var acl = this.acl;

  return function loadGroups(req, res, next) {
    if (req.neo4acl.groups) return next();
    acl.getUserGroups(req.neo4acl.user_id, function(err, groups) {
      if (!err) {
        req.neo4acl.groups = groups;
      }
      next();
    });
  };

};

/**
 * belongsToAll( groups [, options])
 *
 * Returns a middleware
 * which checks if the user belongs to every passed group
 *
 * @param {String|Array}  groups   Group(s) that the user must belong to
 * @param {Object}        options  Options
 *                            on_success: {Function} fn(req, res, next)
 *                            on_fail:    {Function} fn(req, res, next)
 *
 * @returns Connect/Express middleware
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

  var settings = _.extend({}, this.settings, args.options);

  return function belongsToAll(req, res, next) {
    if (req.neo4acl.god_admin) return settings.on_success.call(undefined, req, res, next);
    var allowed;

    // Groups not loaded. Query the graph
    if (! _.isArray(req.neo4acl.groups) ) {
      acl.getUserGroups(req.neo4acl.user_id, function(err, grps) {
        if (!err) {
          req.neo4acl.groups = grps;
          allowed = _groupsInUsergroups(grps, args.groups, 'all');
          if (allowed) {
            settings.on_success.call(undefined, req, res, next);
            next();
          } else {
            settings.on_fail.call(undefined, req, res, next);
          }
        }
      });

    // Groups already loaded
    } else {
      allowed = _groupsInUsergroups(req.neo4acl.groups, args.groups, 'all');
      if (allowed) {
        next();
      } else {
        settings.fail_callback.call({}, req, res, next);
      }
    }

  }
};

/**
 * belongsToAny( groups [, options])
 *
 * Returns a middleware
 * which checks if the user belongs to any passed groups
 *
 * @param {String|Array}  groups    Group(s) that the user could belong to
 *
 * @param {Object}        options   Options
 *                            on_success: {Function} fn(req, res, next)
 *                            on_fail:    {Function} fn(req, res, next)
 *
 * @returns Connect/Express middleware
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

  var settings = _.extend({}, this.settings, args.options);

  return function belongsToAny(req, res, next) {
    if (req.neo4acl.god_admin) return settings.on_success.call(undefined, req, res, next);
    var allowed;

    // Groups not loaded. Query the graph
    if (! _.isArray(req.neo4acl.groups) ) {

      acl.getUserGroups(req.neo4acl.user_id, function(err, grps) {
        if (!err) {
          req.neo4acl.groups = grps;
          allowed = _groupsInUsergroups(grps, args.groups, 'any');
          if (allowed) {
            settings.on_success.call(undefined, req, res, next);
          } else {
            settings.on_fail.call(undefined, req, res, next);
          }
        }
      });

    // Groups already loaded
    } else {
      allowed = _groupsInUsergroups(req.neo4acl.groups, args.groups, 'any');
      if (allowed) {
        settings.on_success.call(undefined, req, res, next);
      } else {
        settings.on_fail.call(undefined, req, res, next);
      }
    }

  }
};

/**
 * belongsToAllDirect( groups, [,options])
 *
 * Returns a middleware
 * which checks if the user is a direct member of every of the passed groups
 *
 * @param {String|[String]} groups  Group(s) that the user must directly belong to
 *
 * @param {Object}          options Options
 *                            on_success: {Function} fn(req, res, next)
 *                            on_fail:    {Function} fn(req, res, next)
 *
 * @returns Connect/Express middleware
 * @type Function
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

  var settings = _.extend({}, this.settings, args.options);

  return function belongsToAllDirect(req, res, next) {
    if (req.neo4acl.god_admin) return settings.on_success.call(undefined, req, res, next);
    var allowed;

    // Groups not loaded. Query the graph
    if (! _.isArray(req.neo4acl.groups) ) {

      acl.getUserGroups(req.neo4acl.user_id, function(err, grps) {
        if (!err) {
          req.neo4acl.groups = grps;
          allowed = _groupsInUsergroups(grps, args.groups, 'all', true);
          if (allowed) {
            settings.on_success.call(undefined, req, res, next);
          } else {
            settings.on_fail.call(undefined, req, res, next);
          }
        }
      });

    // Groups already loaded
    } else {
      allowed = _groupsInUsergroups(req.neo4acl.groups, args.groups, 'all', true);
      if (allowed) {
        settings.on_success.call(undefined, req, res, next);
      } else {
        settings.on_fail.call(undefined, req, res, next);
      }
    }

  }

};

/**
 * belongsToAnyDirect( groups, [,options])
 *
 * Returns a middleware
 * which checks if the user is a direct member of any of the passed groups
 *
 * @param {String|[String]} groups  Group(s) that the user could directly belong to
 * @param {Object}          options Options
 *                            on_success: {Function} fn(req, res, next)
 *                            on_fail:    {Function} fn(req, res, next)
 *
 * @returns Connect/Express middleware
 * @type Function
 */
Middleware.prototype.belongsToAnyDirect = function(groups, options) {
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

  var settings = _.extend({}, this.settings, args.options);

  return function belongsToAnyDirect(req, res, next) {
    if (req.neo4acl.god_admin) return settings.on_success.call(undefined, req, res, next);
    var allowed;

    // Groups not loaded. Query the graph
    if (! _.isArray(req.neo4acl.groups) ) {

      acl.getUserGroups(req.neo4acl.user_id, function(err, grps) {
        if (!err) {
          req.neo4acl.groups = grps;
          allowed = _groupsInUsergroups(grps, args.groups, 'any', true);
          if (allowed) {
            settings.on_success.call(undefined, req, res, next);
          } else {
            settings.on_fail.call(undefined, req, res, next);
          }
        }
      });

    // Groups already loaded
    } else {
      allowed = _groupsInUsergroups(req.neo4acl.groups, args.groups, 'any', true);
      if (allowed) {
        settings.on_success.call(undefined, req, res, next);
      } else {
        settings.on_fail.call(undefined, req, res, next);
      }
    }

  }

};

/**
 * hasAllPermissionsOnResources( [resources] [, permissions] [, options])
 *
 * Exports a middleware
 * which checks if the user has all the given permissions
 * over every given resources
 *
 * @param {String|[String]} resources     Resource(s)
 *                                        Default: req.url
 *
 *                                        In the strings you put to populate this param
 *                                        you can use {placeholders}, which will be replaced
 *                                        by the return of req.param('placeholders').
 *                                        If req.param() returns undefined, the '{placeholder}' is not replaced,
 *                                        unless you provide a {placeholder} fallback in otions.params_fallbacks
 *
 * @param {String|[String]} permissions   Permissions(s)
 *                                        Default: req.method
 *
 * @param {Object}          options       Options
 *                            on_success:         {Function} fn(req, res, next)
 *                            on_fail:            {Function} fn(req, res, next)
 *                            params_fallbacks:   {Object}   Hash of parameters fallbacks
 *
 * @returns Connect/Express middleware
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
  // resources, permissions, options
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

  return function hasAllPermissionsOnResources(req, res, next) {
    if (req.neo4acl.god_admin) return settings.on_success.call(undefined, req, res, next);
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
      if (allowed) return settings.on_success.call(undefined, req, res, next);
      return settings.on_fail.call(undefined, req, res, next);
    });

  }

};

/**
 * hasAnyPermissionsOnResources( [resources] [, permissions] [, options])
 *
 * Exports a middleware
 * which checks, for each given resource, if the user has any of the listed permissions
 * (note: it must fullfill all the checks)
 *
 * @param {String|[String]} resources     Resource(s)
 *                                        Default: req.url
 *
 *                                        In the strings you put to populate this param
 *                                        you can use {placeholders}, which will be replaced
 *                                        by the return of req.param('placeholders').
 *                                        If req.param() returns undefined, the '{placeholder}' is not replaced,
 *                                        unless you provide a {placeholder} fallback in otions.params_fallbacks
 *
 * @param {String|[String]} permissions   Permissions(s)
 *                                        Default: to req.method
 *
 * @param {Object}          options       Options
 *                            on_success:         {Function} fn(req, res, next)
 *                            on_fail:            {Function} fn(req, res, next)
 *                            params_fallbacks:   {Object}   Hash of parameters fallbacks
 *
 * @returns Connect/Express middleware
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

  return function hasAnyPermissionsOnResources(req, res, next) {
    if (req.neo4acl.god_admin) return settings.on_success.call(undefined, req, res, next);
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
      if (allowed) return settings.on_success.call(undefined, req, res, next);
      return settings.on_fail.call(undefined, req, res, next);
    });

  }

};

module.exports = function(acl) {

  return new Middleware(acl);

};
