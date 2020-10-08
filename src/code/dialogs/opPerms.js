import { WDialog } from "../leafletClasses";
import Sortable from "../../lib/sortable";
import { getSelectedOperation } from "../selectedOp";
import WasabeeTeam from "../team";
import WasabeeMe from "../me";
import { addPermPromise, delPermPromise } from "../server";
import wX from "../wX";
import { postToFirebase } from "../firebaseSupport";

const OpPermList = WDialog.extend({
  statics: {
    TYPE: "opPermList",
  },

  initialize: function (map = window.map, options) {
    this.type = OpPermList.TYPE;
    WDialog.prototype.initialize.call(this, map, options);
    postToFirebase({ id: "analytics", action: OpPermList.TYPE });
  },

  addHooks: async function () {
    if (!this._map) return;
    WDialog.prototype.addHooks.call(this);
    const operation = getSelectedOperation();
    this._opID = operation.ID;
    if (WasabeeMe.isLoggedIn()) {
      this._me = await WasabeeMe.waitGet();
    } else {
      this._me = null;
    }
    const context = this;
<<<<<<< HEAD
    this._UIUpdateHook = () => {
      context.update();
=======
    this._UIUpdateHook = (newOpData) => {
      context.update(newOpData);
>>>>>>> master
    };
    window.addHook("wasabeeUIUpdate", this._UIUpdateHook);

    this._displayDialog();
  },

  removeHooks: function () {
    window.removeHook("wasabeeUIUpdate", this._UIUpdateHook);
    WDialog.prototype.removeHooks.call(this);
  },

<<<<<<< HEAD
  update: async function () {
    const operation = getSelectedOperation();
    if (this._opID != operation.ID) {
      this._opID = operation.ID;
      console.warn("operation changed while perm dialog open");
    }
=======
  update: function (op) {
>>>>>>> master
    // logged in while dialog open...
    if (!this._me && WasabeeMe.isLoggedIn()) {
      this._me = await WasabeeMe.waitGet();
    }

    this.buildTable(operation);
    this._html.firstChild.replaceWith(this._table.table);
  },

  _displayDialog: function () {
    if (!this._map) return;

    const operation = getSelectedOperation();

    this.buildTable(operation);

    this._html = L.DomUtil.create("div", null);

    this._html.appendChild(this._table.table);
    if (this._me && operation.IsOwnedOp()) {
      const already = new Set();
      for (const a of operation.teamlist) already.add(a.teamid);

      const addArea = L.DomUtil.create("div", null, this._html);
      const teamMenu = L.DomUtil.create("select", null, addArea);
      for (const t of this._me.Teams) {
        // if (already.has(t.ID)) continue;
        const o = L.DomUtil.create("option", null, teamMenu);
        o.value = t.ID;
        o.textContent = t.Name;
      }
      const permMenu = L.DomUtil.create("select", null, addArea);
      const read = L.DomUtil.create("option", null, permMenu);
      read.value = "read";
      read.textContent = wX("READ");
      const write = L.DomUtil.create("option", null, permMenu);
      write.value = "write";
      write.textContent = wX("WRITE");
      const ao = L.DomUtil.create("option", null, permMenu);
      ao.value = "assignedonly";
      ao.textContent = wX("ASSIGNED_ONLY");

      const zoneMenu = L.DomUtil.create("select", null, addArea);
      const zoneAll = L.DomUtil.create("option", null, zoneMenu);
      zoneAll.value = "0";
      zoneAll.textContent = "All";
      for (const oz of operation.zones) {
        const z = L.DomUtil.create("option", null, zoneMenu);
        z.value = oz.id;
        z.textContent = oz.name;
      }

      const ab = L.DomUtil.create("button", null, addArea);
      ab.type = "button";
      ab.name = "Add";
      ab.value = "Add";
      ab.textContent = wX("ADD");

      L.DomEvent.on(ab, "click", (ev) => {
        L.DomEvent.stop(ev);
        this.addPerm(teamMenu.value, permMenu.value); // async, but no need to await
        // addPerm calls wasabeeUIUpdate, which redraws the screen
      });
    }

    const buttons = {};
    buttons[wX("OK")] = () => {
      this._dialog.dialog("close");
    };

    this._dialog = window.dialog({
      title: wX("PERMS", operation.name),
      html: this._html,
      height: "auto",
      dialogClass: "wasabee-dialog wasabee-dialog-perms",
      closeCallback: () => {
        this.disable();
        delete this._dialog;
      },
      id: window.plugin.wasabee.static.dialogNames.linkList,
    });
    this._dialog.dialog("option", "buttons", buttons);
  },

<<<<<<< HEAD
  buildTable: function (operation) {
=======
  // needs this._operation.teamlist;
  buildTable: function () {
>>>>>>> master
    this._table = new Sortable();
    this._table.fields = [
      {
        name: wX("TEAM"),
        value: (perm) => {
<<<<<<< HEAD
          // try the team cache first
          const t = WasabeeTeam.cacheGet(perm.teamid);
=======
          const t = WasabeeTeam.get(perm.teamid);
>>>>>>> master
          if (t) return t.name;
          // check the "me" list
          if (this._me) {
            for (const mt of this._me.Teams) {
              if (mt.ID == perm.teamid) return mt.Name;
            }
          }
          // default to the id
          return "[" + perm.teamid + "]";
        },
        sort: (a, b) => a.localeCompare(b),
        // , format: (cell, value) => (cell.textContent = value)
      },
      {
        name: wX("ROLE"),
        value: (perm) => perm.role,
        sort: (a, b) => a.localeCompare(b),
        // , format: (cell, value) => (cell.textContent = value)
      },
<<<<<<< HEAD
      {
        name: "Zone",
        value: (perm) => operation.zoneName(perm.zone),
        sort: (a, b) => a.localeCompare(b),
        // , format: (cell, value) => (cell.textContent = value)
      },
=======
>>>>>>> master
    ];

    if (WasabeeMe.isLoggedIn()) {
      this._table.fields.push({
        name: wX("REMOVE"),
        value: () => wX("REMOVE"),
        sort: (a, b) => a.localeCompare(b),
        format: (cell, value, obj) => {
          const link = L.DomUtil.create("a", null, cell);
          link.href = "#";
          link.textContent = value;
          L.DomEvent.on(link, "click", (ev) => {
            L.DomEvent.stop(ev);
            this.delPerm(obj); // calls wasabeeUIUpdate -- async but no need to await
          });
        },
      });
    }
    this._table.sortBy = 0;
    this._table.items = operation.teamlist;
  },

<<<<<<< HEAD
  addPerm: async function (teamID, role, zone) {
=======
  addPerm: function (teamID, role) {
>>>>>>> master
    if (!WasabeeMe.isLoggedIn()) {
      alert(wX("NOT LOGGED IN SHORT"));
      return;
    }
    const operation = getSelectedOperation();
    for (const p of operation.teamlist) {
      if (p.teamid == teamID && p.role == role && p.zone == zone) {
        console.warn("not adding duplicate permission");
        window.runHooks("wasabeeUIUpdate");
        return;
      }
    }
<<<<<<< HEAD
    try {
      await addPermPromise(operation.ID, teamID, role, zone);
      // add locally for display
      operation.teamlist.push({ teamid: teamID, role: role, zone: zone });
      operation.store();
      window.runHooks("wasabeeUIUpdate");
    } catch (e) {
      console.error(e);
      alert(e.toString());
    }
  },

  delPerm: async function (obj) {
=======
    // send to server
    addPermPromise(this._operation.ID, teamID, role).then(
      () => {
        // then add locally for display
        this._operation.teamlist.push({
          teamid: teamID,
          role: role,
        });
        this._operation.store();
        window.runHooks("wasabeeUIUpdate", getSelectedOperation());
      },
      (err) => {
        console.log(err);
        alert(err);
      }
    );
  },

  delPerm: function (obj) {
>>>>>>> master
    if (!WasabeeMe.isLoggedIn()) {
      alert(wX("NOT LOGGED IN SHORT"));
      return;
    }
<<<<<<< HEAD
    const operation = getSelectedOperation();
    try {
      await delPermPromise(operation.ID, obj.teamid, obj.role);
      const n = new Array();
      for (const p of operation.teamlist) {
        if (p.teamid != obj.teamid || p.role != obj.role) n.push(p);
      }
      operation.teamlist = n;
      operation.store();
      window.runHooks("wasabeeUIUpdate");
    } catch (e) {
      console.error(e);
      alert(e.toString());
    }
=======
    // send change to server
    delPermPromise(this._operation.ID, obj.teamid, obj.role).then(
      () => {
        // then remove locally for display
        const n = new Array();
        for (const p of this._operation.teamlist) {
          if (p.teamid != obj.teamid || p.role != obj.role) n.push(p);
        }
        this._operation.teamlist = n;
        this._operation.store();
        window.runHooks("wasabeeUIUpdate", getSelectedOperation());
      },
      (err) => {
        console.log(err);
        alert(err);
      }
    );
>>>>>>> master
  },
});

export default OpPermList;
