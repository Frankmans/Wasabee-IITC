import { WDialog } from "../leafletClasses";
import Sortable from "../../lib/sortable";
import { getSelectedOperation } from "../selectedOp";
import { listenForAddedPortals, listenForPortalDetails } from "../uiCommands";
import WasabeePortal from "../portal";
import wX from "../wX";

const BlockerList = WDialog.extend({
  statics: {
    TYPE: "blockerList"
  },

  initialize: function(map, options) {
    if (!map) map = window.map;
    this.type = BlockerList.TYPE;
    WDialog.prototype.initialize.call(this, map, options);
    this._operation = getSelectedOperation();
  },

  addHooks: function() {
    if (!this._map) return;
    WDialog.prototype.addHooks.call(this);
    const context = this;
    this._UIUpdateHook = newOpData => {
      context.blockerlistUpdate(newOpData);
    };
    window.addHook("wasabeeUIUpdate", this._UIUpdateHook);
    window.addHook("portalAdded", listenForAddedPortals);
    window.addHook("portalDetailLoaded", listenForPortalDetails);
    this._displayDialog();
  },

  removeHooks: function() {
    WDialog.prototype.removeHooks.call(this);
    window.removeHook("wasabeeUIUpdate", this._UIUpdateHook);
    window.removeHook("portalAdded", listenForAddedPortals);
    window.removeHook("portalDetailLoaded", listenForPortalDetails);
  },

  _displayDialog: function() {
    if (!this._map) return;

    this.sortable = this._getListDialogContent(0, false); // defaults to sorting by op order

    for (const f of this._operation.fakedPortals) {
      window.portalDetail.request(f.id);
    }

    this._dialog = window.dialog({
      title: wX("KNOWN_BLOCK", this._operation.name),
      width: "auto",
      height: "auto",
      html: this.sortable.table,
      dialogClass: "wasabee-dialog wasabee-dialog-blockerlist",
      buttons: {
        OK: () => {
          this._dialog.dialog("close");
          window.runHooks("wasabeeUIUpdate", this._operation);
        },
        "Auto Mark": () => {
          this.automark();
        },
        Reset: () => {
          this._operation.blockers = new Array();
          this.blockerlistUpdate(this._operation);
          this._operation.update(false); // blockers do not need to be sent to server
          window.runHooks("wasabeeCrosslinks", this._operation);
        },
        "Force Load": () => {
          for (const f of this._operation.fakedPortals) {
            window.portalDetail.request(f.id);
          }
        }
      },
      closeCallback: () => {
        this.disable();
        delete this._dialog;
      },
      id: window.plugin.wasabee.static.dialogNames.blockerList
    });
  },

  // when the wasabeeUIUpdate hook is called from anywhere, update the display data here
  blockerlistUpdate: function(newOpData) {
    this._operation = newOpData;
    if (!this._enabled) return;
    this.sortable = this._getListDialogContent(
      this.sortable.sortBy,
      this.sortable.sortAsc
    );
    this._dialog.html(this.sortable.table);
    this._dialog.dialog(
      wX("OPTION"),
      wX("TITLE"),
      wX("KNOWN_BLOCK", newOpData.name)
    );
  },

  _getListDialogContent(sortBy, sortAsc) {
    const content = new Sortable();
    content.fields = [
      {
        name: wX("FROM_PORT"),
        value: blocker => {
          return this._operation.getPortal(blocker.fromPortalId).name;
        },
        sort: (a, b) => a.localeCompare(b),
        format: (row, value, blocker) => {
          const p = this._operation.getPortal(blocker.fromPortalId);
          row.appendChild(p.displayFormat(this._smallScreen));
        }
      },
      {
        name: wX("COUNT"),
        value: blocker => {
          const c = this._operation.blockers.filter(
            b =>
              b.fromPortalId == blocker.fromPortalId ||
              b.toPortalID == blocker.fromPortalId
          );
          return c.length;
        },
        // sort: (a, b) => a - b,
        format: (row, value) => (row.textContent = value)
      },
      {
        name: wX("TO_PORT"),
        value: blocker => {
          return this._operation.getPortal(blocker.toPortalId).name;
        },
        sort: (a, b) => a.localeCompare(b),
        format: (row, value, blocker) => {
          const p = this._operation.getPortal(blocker.toPortalId);
          row.appendChild(p.displayFormat(this._smallScreen));
        }
      },
      {
        name: wX("COUNT"),
        value: blocker => {
          const c = this._operation.blockers.filter(
            b =>
              b.fromPortalId == blocker.toPortalId ||
              b.toPortalId == blocker.toPortalId
          );
          return c.length;
        },
        // sort: (a, b) => a - b,
        format: (row, value) => (row.textContent = value)
      }
    ];
    content.sortBy = sortBy;
    content.sortAsc = !sortAsc; // I don't know why this flips
    content.items = this._operation.blockers;
    return content;
  },

  automark() {
    // build count list
    const portals = new Array();
    for (const b of this._operation.blockers) {
      if (
        !this._operation.containsMarkerByID(
          b.fromPortalId,
          window.plugin.wasabee.static.constants.MARKER_TYPE_EXCLUDE
        )
      )
        portals.push(b.fromPortalId);
      if (
        !this._operation.containsMarkerByID(
          b.toPortalId,
          window.plugin.wasabee.static.constants.MARKER_TYPE_EXCLUDE
        )
      )
        portals.push(b.toPortalId);
    }
    const reduced = {};
    for (const p of portals) {
      if (!reduced[p]) reduced[p] = 0;
      reduced[p]++;
    }
    const sorted = Object.entries(reduced).sort((a, b) => b[1] - a[1]);

    // return from recursion
    if (sorted.length == 0) return;

    const portalId = sorted[0][0];

    // put in some smarts for picking close portals, rather than random ones
    // when the count gets > 3

    // get WasabeePortal for portalId
    let wportal = this._operation.getPortal(portalId);
    if (!wportal) wportal = WasabeePortal.get(portalId);
    if (!wportal) {
      alert(wX("AUTOMARK STOP"));
      return;
    }
    // console.log(wportal);

    // add marker
    let type = window.plugin.wasabee.static.constants.MARKER_TYPE_DESTROY;
    if (
      window.portals[portalId] &&
      window.portals[portalId].options &&
      window.portals[portalId].options.data &&
      window.portals[portalId].options.data.team == "E"
    ) {
      type = window.plugin.wasabee.static.constants.MARKER_TYPE_VIRUS;
    }
    this._operation.addMarker(type, wportal, "auto-marked");

    // remove nodes from blocker list
    this._operation.blockers = this._operation.blockers.filter(b => {
      if (b.fromPortalId == portalId || b.toPortalId == portalId) return false;
      return true;
    });
    window.runHooks("wasabeeUIUpdate", this._operation);
    // recurse
    this.automark();
  }
});

export default BlockerList;
