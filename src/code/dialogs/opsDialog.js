import { WDialog } from "../leafletClasses";
import { deleteOpPromise } from "../server";
import { clearAllItems } from "../uiCommands";
import ConfirmDialog from "./confirmDialog";
import {
  getSelectedOperation,
  getOperationByID,
  makeSelectedOperation,
  opsList,
  removeOperation,
  duplicateOperation
} from "../selectedOp";
import OpPermList from "./opPerms";
import wX from "../wX";

const OpsDialog = WDialog.extend({
  statics: {
    TYPE: "opsDialog"
  },

  initialize: function(map, options) {
    if (!map) map = window.map;
    this.type = OpsDialog.TYPE;
    WDialog.prototype.initialize.call(this, map, options);
  },

  addHooks: function() {
    if (!this._map) return;
    WDialog.prototype.addHooks.call(this);
    this._displayDialog();

    const context = this;
    this._UIUpdateHook = newOpData => {
      context.update(newOpData);
    };
    window.addHook("wasabeeUIUpdate", this._UIUpdateHook);
  },

  removeHooks: function() {
    WDialog.prototype.removeHooks.call(this);
    window.removeHook("wasabeeUIUpdate", this._UIUpdateHook);
  },

  _displayDialog: function() {
    this.makeContent(getSelectedOperation());

    this._dialog = window.dialog({
      title: wX("OPERATIONS"),
      width: "auto",
      height: "auto",
      html: this._content,
      dialogClass: "wasabee-dialog wasabee-dialog-ops",
      closeCallback: () => {
        this.disable();
        delete this._content;
        delete this._dialog;
      },
      id: window.plugin.wasabee.static.dialogNames.opsButton
    });
  },

  update: function(selectedOp) {
    if (this._enabled && this._dialog && this._dialog.html) {
      this.makeContent(selectedOp);
      this._dialog.html(this._content);
    }
  },

  makeContent: function(selectedOp) {
    const content = L.DomUtil.create("div");
    const topSet = L.DomUtil.create("div", "topset", content);
    const operationSelect = L.DomUtil.create("select", null, topSet);

    const ol = opsList();
    for (const opID of ol) {
      const tmpOp = getOperationByID(opID);
      const option = L.DomUtil.create("option", null, operationSelect);
      option.value = opID;
      option.text = tmpOp.name;
      if (opID == selectedOp.ID) option.selected = true;
    }

    L.DomEvent.on(operationSelect, "change", ev => {
      L.DomEvent.stop(ev);
      const newop = makeSelectedOperation(operationSelect.value);
      const mbr = newop.mbr;
      if (mbr && isFinite(mbr._southWest.lat) && isFinite(mbr._northEast.lat)) {
        this._map.fitBounds(mbr);
      }
      window.runHooks("wasabeeUIUpdate", newop);
      window.runHooks("wasabeeCrosslinks", newop);
    });

    const writable = selectedOp.IsWritableOp();

    const nameLabel = L.DomUtil.create("label", null, topSet);
    nameLabel.textContent = wX("OPER_NAME");
    const nameDisplay = L.DomUtil.create("div", null, topSet);
    if (writable) {
      const input = L.DomUtil.create("input", null, nameDisplay);
      input.value = selectedOp.name;
      L.DomEvent.on(input, "change", ev => {
        L.DomEvent.stop(ev);
        if (!input.value || input.value == "") {
          alert(wX("USE_VALID_NAME"));
        } else {
          selectedOp.name = input.value;
          selectedOp.store();
          window.runHooks("wasabeeUIUpdate", selectedOp);
        }
      });
    } else {
      nameDisplay.textContent = selectedOp.name;
    }

    if (writable) {
      const colorLabel = L.DomUtil.create("label", null, topSet);
      colorLabel.textContent = wX("OPER_COLOR");
      const operationColor = selectedOp.color
        ? selectedOp.color
        : window.plugin.wasabee.static.constants.DEFAULT_OPERATION_COLOR;
      const colorDisplay = L.DomUtil.create("div", null, topSet);
      const opColor = L.DomUtil.create("select", null, colorDisplay);
      for (const cd of window.plugin.wasabee.static.layerTypes) {
        if (cd[0] == "SE" || cd[0] == "self-block") continue;
        const c = cd[1];
        const option = L.DomUtil.create("option", null, opColor);
        if (c.name == operationColor) option.selected = true;
        option.value = c.name;
        option.textContent = c.displayName;
      }
      L.DomEvent.on(opColor, "change", ev => {
        L.DomEvent.stop(ev);
        selectedOp.color = opColor.value;
        selectedOp.store();
        window.runHooks("wasabeeUIUpdate", selectedOp);
      });
    }

    if (writable) {
      const commentInput = L.DomUtil.create("textarea", null, topSet);
      commentInput.placeholder = "Op Comment";
      commentInput.value = selectedOp.comment;
      L.DomEvent.on(commentInput, "change", ev => {
        L.DomEvent.stop(ev);
        selectedOp.comment = commentInput.value;
        selectedOp.store();
      });
    } else {
      const commentDisplay = L.DomUtil.create("p", "comment", topSet);
      commentDisplay.textContent = selectedOp.comment;
    }

    const buttonSection = L.DomUtil.create("div", "buttonset", content);
    if (writable) {
      const clearOpDiv = L.DomUtil.create("div", null, buttonSection);
      const clearOpButton = L.DomUtil.create("button", null, clearOpDiv);
      // adding a comment so that github will let me create a pull request to fix the issue with CLEAR_EVERYTHING showing up on the button instead of the correct text. Scott, pleae double check the line below this - I left off the wX code in the previous version.
      clearOpButton.textContent = wX("CLEAR_EVERYTHING");
      L.DomEvent.on(clearOpButton, "click", ev => {
        L.DomEvent.stop(ev);
        clearAllItems(selectedOp);
        selectedOp.store();
      });
    }

    if (opsList().length > 1) {
      const deleteDiv = L.DomUtil.create("div", null, buttonSection);
      const deleteButton = L.DomUtil.create("button", null, deleteDiv);
      if (selectedOp.IsOwnedOp()) {
        deleteButton.textContent = wX("DELETE_OP", selectedOp.name);
        if (selectedOp.IsServerOp())
          deleteButton.textContent += wX("LOCFRMSER");
      } else {
        deleteButton.textContent = wX("REM_LOC_CP", selectedOp.name);
      }
      L.DomEvent.on(deleteButton, "click", ev => {
        L.DomEvent.stop(ev);
        // this should be moved to uiCommands
        const con = new ConfirmDialog(window.map);
        con.setup(
          wX("CON_DEL", selectedOp.name),
          wX("YESNO_DEL", selectedOp.name),
          () => {
            if (selectedOp.IsServerOp() && selectedOp.IsOwnedOp()) {
              deleteOpPromise(selectedOp.ID).then(
                function() {
                  console.log("delete from server successful");
                },
                function(err) {
                  console.log(err);
                  alert(err);
                }
              );
            }
            const ol = opsList();
            let newopID = ol[0];
            if (newopID == null || newopID == selectedOp.ID) {
              console.log(
                "removing first op in list? I was going to use that...."
              );
              newopID = ol[1];
              if (newopID == null) {
                console.log("not removing last op... fix this");
                // create a new default op and use that -- just call the init/reset functions?
              }
            }
            const removeid = selectedOp.ID;
            const newop = makeSelectedOperation(newopID);
            const mbr = newop.mbr;
            if (
              mbr &&
              isFinite(mbr._southWest.lat) &&
              isFinite(mbr._northEast.lat)
            ) {
              this._map.fitBounds(mbr);
            }
            removeOperation(removeid);
            window.runHooks("wasabeeUIUpdate", newop);
            window.runHooks("wasabeeCrosslinks", newop);
          }
        );
        con.enable();
      });
    }

    if (selectedOp.IsServerOp()) {
      const permsDiv = L.DomUtil.create("div", null, buttonSection);
      const permsButton = L.DomUtil.create("button", null, permsDiv);
      permsButton.textContent = wX("OP_PERMS");
      L.DomEvent.on(permsButton, "click", ev => {
        L.DomEvent.stop(ev);
        const opl = new OpPermList();
        opl.enable();
      });
    }

    const dupeDiv = L.DomUtil.create("div", null, buttonSection);
    const dupeButton = L.DomUtil.create("button", null, dupeDiv);
    dupeButton.textContent = wX("DUPE_OP");
    L.DomEvent.on(dupeButton, "click", ev => {
      L.DomEvent.stop(ev);
      duplicateOperation(selectedOp.ID);
      window.runHooks("wasabeeUIUpdate", window.plugin.wasabee._selectedOp);
    });

    this._content = content;
  }
});

export default OpsDialog;
