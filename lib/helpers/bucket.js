var _ = require('underscore');

var Bucket = function() {
  this._collection = [];
};

Bucket.prototype.add = function(str) {
  if (! (_.isString(str) && str.length) ) return this;
  this._collection.push(str);
  return this;
};

Bucket.prototype.output = function(separator) {
  separator = _.isString(separator) ? separator : '';
  return this._collection.join(separator);
};

Bucket.prototype.wrappedOutput = function(separator, before, after) {
  separator = _.isString(separator) ? separator : '';
  before = _.isString(separator) ? separator : '';
  after = _.isString(separator) ? separator : '';
  
  var ret = _(this._collection).map(function(str) {
    return before + str + after;
  });
  
  return ret.join(separator);
};

module.exports = function() {
  var _buckets = {};
  var bucket = function(name) {
    if (_buckets[name]) return _buckets[name];
    _buckets[name] = new Bucket();
    return _buckets[name];
  };
  
  return bucket;
  
};