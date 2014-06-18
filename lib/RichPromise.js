var Promise = require("bluebird");

module.exports = function(acl, query, parameters, cb, parse_fn) {
  var p_res;
  var p_rej;
  var fired = false;

  var promise = new Promise(function(resolve, reject) {
    p_res = resolve;
    p_rej = reject;
  });

  promise.promise = function() {
    return promise;
  }
  promise.originalQuery = query;
  promise.query = query = acl._renameIdentifiers(query);

  promise.parameters = parameters;
  promise.parser = function(callback) {
    return function(err, result) {
      var output = (parse_fn && typeof parse_fn === 'function') ? parse_fn(err, result) : result;
      if (callback && typeof callback === 'function') {
        callback(err, output);
      }
      return output;
    }
  };
  promise.execute = function() {
    if (!fired) {
      fired = true;
      acl.db.query(query, parameters, function(err, result) {
        var output = promise.parser(cb)(err, result);
        if (err) {
          p_rej(err);
        } else {
          p_res(output);
        }
      });
    }
    return promise;
  };

  if (cb && typeof cb === 'function') promise.execute();

  return promise;
};
