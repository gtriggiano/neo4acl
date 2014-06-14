var _ = require('underscore');
var Args = require('args-js');

var paramRegex = /\{(\w+)\}/g;

var _getDescendantProperty = function(obj, desc) {
    var arr = desc.split(".");
    while(arr.length && (obj = obj[arr.shift()]));
    return obj;
};

var _replaceParameters = function(resources, searchFn) {
  var ret = [];

  resources.forEach(function(resource) {
    var parsedResource = resource;
    var allParamsFound = true;
    var tmpParam;
    var params = {};
    var tmpMatch;

    while (tmpMatch = paramRegex.exec(resource)) {
      var tmpParam = tmpMatch[1];
      if (! params[tmpParam] ) {
        var value = searchFn(tmpParam);
        if (typeof value !== 'undefined') {
          var replaceRegex = new RegExp('\{'+ tmpParam +'\}','g');
          parsedResource = parsedResource.replace(replaceRegex, value);
        }
      }
    }

    if (allParamsFound) {
      ret.push(parsedResource);
    }

  });

  return ret;
};

var Middleware = function(acl) {
  this.settings = {
    user_id_path: 'user._id',
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
 * hasAnyRole( role [, options])
 *
 * Exports a middleware
 * which checks if the logged user has any of the passed role
 *
 * @param {String|Array}  role    Role(s) that the user could have
 * @param {Object}        options Options
 *
 * @returns Middleware
 * @type Function
 */
Middleware.prototype.hasAnyRole = function(role, options) {
  var acl = this.acl;

  var args = Args([
               [
                 {role_string: Args.STRING},
                 {role_list: Args.ARRAY}
               ],
               {options: Args.OBJECT | Args.Optional,
                _default: {}}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.roles = acl._ensureCoUS(args.role_string, args.role_list);

  var settings = _.extend(this.settings, options);

  return function(req, res, next) {
    var userId = settings.user_id ? settings.user_id : _getDescendantProperty(req, settings.user_id_path);
    if (!userId) return settings.fail_callback.call({}, req, res, next);

    acl.userHasAnyRole(userId, args.roles, function(err, verified) {
      if (verified) return next();
      return settings.fail_callback.call({}, req, res, next);
    });
  }
};

/**
 * hasAllRoles( roles [, options])
 *
 * Exports a middleware
 * which checks if the logged user has every passed role
 *
 * @param {String|Array}  roles    Roles that the user should have
 * @param {Object}        options  Options
 *
 * @returns Middleware
 * @type Function
 */
Middleware.prototype.hasAllRoles = function(roles, options) {
  var acl = this.acl;

  var args = Args([
               [
                 {role_string: Args.STRING},
                 {role_list: Args.ARRAY}
               ],
               {options: Args.OBJECT | Args.Optional,
                _default: {}}
             ], arguments);

             // Ensure args.roles is a CoUS
             args.roles = acl._ensureCoUS(args.role_string, args.role_list);

  var settings = _.extend(this.settings, options);

  return function(req, res, next) {
    var userId = settings.user_id ? settings.user_id : _getDescendantProperty(req, settings.user_id_path);
    if (!userId) return settings.fail_callback.call({}, req, res, next);

    acl.userHasAllRoles(userId, args.roles, function(err, verified) {
      if (verified) return next();
      return settings.fail_callback.call({}, req, res, next);
    });
  }
};

/**
 * hasPermission( [resource] [, permissions] [, options])
 *
 * Exports a middleware
 * which checks if the logged user has the given permissions
 * over the given resources
 *
 * @param {String|Array} role         Resource(s) Defaults to req.url
 * @param {String|Array} permissions  Permissions(s) Defaults to req.method
 * @param {Object}       options      Options
 *
 * @returns Middleware
 * @type Function
 */
Middleware.prototype.hasPermission = function(resources, permissions, options) {
  var acl = this.acl;

  switch (arguments.length) {
  case 1:
    options = resources;
    resources = permissions = [];
    break;
  case 2:
    options = permissions;
    permissions = resources;
    resources = [];
    break;
  default:

  }

  resources = typeof resources !== 'undefined' && (_.isString(resources) || _.isArray(resources)) ?
                resources : [];

  permissions = typeof permissions != 'undefined' && (_.isString(permissions) || _.isArray(permissions)) ?
                permissions : [];

  options = typeof options != 'undefined' && _.isObject(options) ?
                options : {};

             // Ensure args.resources is a CoUS
             resources = acl._ensureCoUS(resources, resources);

             // Ensure args.permissions is a CoUS
             permissions = acl._ensureCoUS(permissions, permissions);

  var settings = _.extend(this.settings, options);

  return function(req, res, next) {
    var userId = settings.user_id ? settings.user_id : _getDescendantProperty(req, settings.user_id_path);
    if (!userId) return settings.fail_callback.call({}, req, res, next);

    var theResources;

    if (! resources.length) {
      theResources = req.url;
    } else {
      theResources = _replaceParameters(resources, req.param);
    }

    var thePermissions = permissions.length ? permissions : req.method;

    acl.isAllowed(userId, theResources, thePermissions, function(err, allowed) {
      if (allowed) return next();
      return settings.fail_callback.call({}, req, res, next);
    });
  }

};

module.exports = function(acl) {

  return new Middleware(acl);

};
