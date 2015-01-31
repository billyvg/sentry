/** @jsx React.DOM */

var Reflux = require("reflux");


// TODO(dcramer): we should probably just make every parameter update
// work on bulk aggregates
var AggregateListActions = Reflux.createActions([
  "assignTo",
  "assignToError",
  "assignToSuccess",
  "delete",
  "deleteError",
  "deleteSuccess",
  "update",
  "updateError",
  "updateSuccess",
  "merge",
  "mergeError",
  "mergeSuccess"
]);


module.exports = AggregateListActions;
