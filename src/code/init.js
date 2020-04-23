import { initCrossLinks } from "./crosslinks";
import initServer from "./server";
import { setupLocalStorage, initSelectedOperation } from "./selectedOp";
import { drawThings, drawAgents } from "./mapDrawing";
import addButtons from "./addButtons";
import { setupToolbox } from "./toolbox";
import { initFirebase } from "./firebaseSupport";
import { initWasabeeD } from "./wd";
import { sendLocation } from "./uiCommands";
import wX from "./wX";

const Wasabee = window.plugin.wasabee;

window.plugin.wasabee.init = function() {
  if (Wasabee._inited) return;
  Wasabee._inited = true;
  Object.freeze(Wasabee.static);

  if (window.plugin.sync) alert(wX("DISABLE_SYNC"));

  window.pluginCreateHook("wasabeeUIUpdate");

  Wasabee._selectedOp = null; // the in-memory working op;
  Wasabee.teams = new Map();
  Wasabee._agentCache = new Map();

  initGoogleAPI();
  setupLocalStorage();
  initSelectedOperation();
  initServer();

  addCSS("main", Wasabee.static.CSS.main);

  Wasabee.portalLayerGroup = new L.LayerGroup();
  Wasabee.linkLayerGroup = new L.LayerGroup();
  Wasabee.markerLayerGroup = new L.LayerGroup();
  Wasabee.agentLayerGroup = new L.LayerGroup();
  window.addLayerGroup("Wasabee Draw Portals", Wasabee.portalLayerGroup, true);
  window.addLayerGroup("Wasabee Draw Links", Wasabee.linkLayerGroup, true);
  window.addLayerGroup("Wasabee Draw Markers", Wasabee.markerLayerGroup, true);
  window.addLayerGroup("Wasabee Agents", Wasabee.agentLayerGroup, true);

  window.addHook("mapDataRefreshStart", () => {
    drawAgents(Wasabee._selectedOp);
  });

  window.addHook("wasabeeUIUpdate", operation => {
    drawThings(operation);
  });

  // enable and test in 0.15 -- works on IITC-CE but not on iitc.me
  if (window.addResumeFunction) {
    window.addResumeFunction(() => {
      window.runHooks("wasabeeUIUpdate", Wasabee._selectedOp);
      sendLocation();
    });
  }

  window.map.on("layeradd", obj => {
    if (
      obj.layer === Wasabee.portalLayerGroup ||
      obj.layer === Wasabee.linkLayerGroup ||
      obj.layer === Wasabee.markerLayerGroup
    ) {
      window.runHooks("wasabeeUIUpdate", Wasabee._selectedOp);
    }
  });

  window.map.on("layerremove", obj => {
    if (
      obj.layer === Wasabee.portalLayerGroup ||
      obj.layer === Wasabee.linkLayerGroup ||
      obj.layer === Wasabee.markerLayerGroup
    ) {
      obj.layer.clearLayers();
    }
  });

  initFirebase();
  initCrossLinks();
  initWasabeeD();

  const sl = localStorage[Wasabee.static.constants.SEND_LOCATION_KEY];
  if (sl !== "true") {
    console.log(sl);
    console.log("resetting sendlocation to false");
    localStorage[Wasabee.static.constants.SEND_LOCATION_KEY] = "false";
  }

  // once everything else is done, do the initial draw
  addButtons(Wasabee._selectedOp);
  setupToolbox();
  window.runHooks("wasabeeUIUpdate", Wasabee._selectedOp);
  if (window.VALID_HOOKS.includes("wasabeeCrosslinks"))
    window.runHooks("wasabeeCrosslinks", Wasabee._selectedOp);
  if (window.VALID_HOOKS.includes("wasabeeDkeys"))
    window.runHooks("wasabeeDkeys");
};

const addCSS = (name, content) => {
  const c = L.DomUtil.create("style", null, document.head);
  c.textContent = content;
  c.id = "wasabee-css-" + name;

  /* not used yet -- for future theme support */
  /* const sheet = new CSSStyleSheet();
  sheet.replaceSync(content);
  // adoptedStyleSheets is frozen, can't use .push(); just overwrite w/ all
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; */
};

const initGoogleAPI = () => {
  if (typeof window.gapi !== "undefined") return;
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.src = "https://apis.google.com/js/client:platform:auth2.js";
  (document.body || document.head || document.documentElement).appendChild(
    script
  );
};
