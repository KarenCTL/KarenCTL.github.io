///////////////////////////////////////////////////////////////////////////
// Copyright 2020, all rights reserved Berntsen International, Inc.
//
// Subject to your agreement of the disclaimer set forth below, permission is given by Berntsen International, Inc. ("Berntsen")
//
// BY USING ALL OR ANY PORTION OF THIS CODE, YOU ACCEPT AND AGREE TO THE BELOW DISCLAIMER. 
//
// If you do not accept or agree to the below disclaimer, then you may not use or modify this code.
// THE CODE IS PROVIDED UNDER THIS LICENSE ON AN "AS IS" BASIS,
// WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, WITHOUT LIMITATION, 
// WARRANTIES THAT THE COVERED CODE IS FREE OF DEFECTS, MERCHANTABLE, FIT FOR A PARTICULAR PURPOSE OR NON-INFRINGING.
// THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE COVERED CODE IS WITH YOU.
// SHOULD ANY COVERED CODE PROVE DEFECTIVE IN ANY RESPECT, YOU (NOT THE INITIAL DEVELOPER OR ANY OTHER CONTRIBUTOR)
// ASSUME THE COST OF ANY NECESSARY SERVICING, REPAIR OR CORRECTION. UNDER NO CIRCUMSTANCES WILL BERNTSEN BE LIABLE TO YOU,
// OR ANY OTHER PERSON OR ENTITY, FOR ANY LOSS OF USE, REVENUE OR PROFIT, LOST OR DAMAGED DATA, 
// OR OTHER COMMERCIAL OR ECONOMIC LOSS OR FOR ANY DAMAGES WHATSOEVER RELATED TO YOUR USE OR RELIANCE UPON THE SOFTWARE,
// EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES OR IF SUCH DAMAGES ARE FORESEEABLE. 
// THIS DISCLAIMER OF WARRANTY AND LIABILITY CONSTITUTES AN ESSENTIAL PART OF THIS LICENSE. 
// NO USE OF ANY COVERED CODE IS AUTHORIZED HEREUNDER EXCEPT UNDER THIS DISCLAIMER.
//
// THE EXPRESS USE OF THIS CODE IS GRANTED PER AGREEMENTS DEFINED IN THE LICENSE AGREEMENT BETWEEN YOU, YOUR ENTITY OR COMPANY AND BERNTSEN.
///////////////////////////////////////////////////////////////////////////

// Handy dialog method
//
define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/Deferred',
  "dojo/_base/connect",
  "dijit/Dialog"
], function (declare, lang, Deferred, connect, dijitDialog) {

  var mo = {};

  var confirmDialog = new dijitDialog({
    style: "width: 300px"
  });
  var connections = []; 

  // Need to find an automatic way to have a button id prefix unique to each instance
  var widgetPrefix = "InfraMarkerRead";
  
  // Displays a dialog controled by the object argument
  //
  // body - string that can contain mark up.
  // title - title at the top of the dialog.
  // labels - array of strings that will be the labels for the buttons.
  // modal - if true user must respond before execution continues.

  mo.confirmDialog = function (params, mode) {

    var resultDef = new Deferred();

    // This allows the dialog to be silenced while still keeping
    // the block structure for the promise fulfillment. 
    if (mode == "skip") {
      resultDef.resolve({
        id: -1,
        event: null
      });
      return resultDef.promise;
    }

    var body = params["body"];
    if (body == null || body == undefined) {
      // error return??
      return;
    }

    var title = params["title"];
    if (title == null || title == undefined) {
      title = "";
    }

    var content = "<div class='dijitDialogPaneContentArea'>" + body + "</div>";
    var buttonCount;

    var labels = params["buttons"];
    if (labels == null || labels == undefined) {
      buttonCount = 0;
    }

    else if (typeof labels === 'object') {
      buttonCount = labels.length;
    }

    else if (typeof labels === 'string') {
      buttonCount = 1;
      labels = [labels];
    }

    else {
      buttonCount = 0;
    }

    if (buttonCount > 0) {
      content = content + "<div class='dijitDialogPaneActionBar'>";
      for (var i = 1; i <= buttonCount; i++) {
        content = content + "\n<button data-dojo-type='dijit/form/Button' type='button'  id='" + widgetPrefix + i + "'>" + labels[i - 1] + "</button>";
      }
      content = content + "</div>";
    }

    confirmDialog.set("title", title);
    confirmDialog.set("content", content);
    confirmDialog.show();

    for (var i = 1; i <= buttonCount; i++) {

      var node = dojo.byId(widgetPrefix + i);
      var handle = dojo.connect(node, "onclick", lang.hitch(this, function (event) {

        var idStr = event.target.id;
        var id = Number.NaN;
        if (idStr.startsWith(widgetPrefix)) {
          idStr = idStr.substr(widgetPrefix.length, idStr.length);
          id = parseInt(idStr);
        }
        console.log("dialogBtnClick " + id);
        confirmDialog.hide();
        dojo.forEach(connections, dojo.disconnect); 
        resultDef.resolve({
          id: id,
          event: event
        });
      }));
      connections.push(handle); 
    }
    return resultDef.promise;
  };

  mo.dialogBtnClick = function (event) {

    var id = event.target.id;
    console.log("dialogBtnClick" + id);
  };

  return mo;
});
