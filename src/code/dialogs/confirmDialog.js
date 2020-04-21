import { WDialog } from "../leafletClasses";
import { getSelectedOperation } from "../selectedOp";
import wX from "../wX";

// generic confirmation screen w/ ok and cancel buttons

const ConfirmDialog = WDialog.extend({
  statics: {
    TYPE: "confirmDialog"
  },

  initialize: function(map, options) {
    if (!map) map = window.map;
    this.type = ConfirmDialog.TYPE;
    WDialog.prototype.initialize.call(this, map, options);
    this._title = wX("NO_TITLE");
    this._label = wX("NO_LABEL");
  },

  addHooks: function() {
    if (!this._map) return;
    WDialog.prototype.addHooks.call(this);
    this._displayDialog();
  },

  removeHooks: function() {
    WDialog.prototype.removeHooks.call(this);
    window.runHooks("wasabeeUIUpdate", getSelectedOperation());
  },

  _displayDialog: function() {
    if (!this._map) return;
    this._dialog = window.dialog({
      title: this._title,
      width: "auto",
      height: "auto",
      html: this._buildContent(),
      dialogClass: "wasabee-dialog wasabee-dialog-confirm",
      buttons: {
        OK: () => {
          if (this._callback) this._callback();
          this._dialog.dialog("close");
        },
        Cancel: () => {
          if (this._cancelCallback) this._cancelCallback();
          this._dialog.dialog("close");
        }
      },
      closeCallback: () => {
        this.disable();
        delete this._dialog;
      }
      // id: window.plugin.wasabee.static.dialogNames.XXX
    });
  },

  setup: function(title, label, callback, cancelCallback) {
    this._title = title;
    this._label = label;
    if (callback) this._callback = callback;
    if (cancelCallback) this._cancelCallback = cancelCallback;
  },

  _buildContent: function() {
    const content = L.DomUtil.create("div", "title");
    if (typeof this._label == "string") {
      content.textContent = this._label;
    } else {
      content.appendChild(this._label);
    }
    return content;
  }
});

export default ConfirmDialog;
