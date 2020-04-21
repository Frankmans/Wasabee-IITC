import { WTooltip, WButton } from "../leafletClasses";
import wX from "../wX";
import WasabeePortal from "../portal";
import { getSelectedOperation } from "../selectedOp";

const QuickdrawButton = WButton.extend({
  statics: {
    TYPE: "quickdrawButton"
  },

  initialize: function(map, container) {
    if (!map) map = window.map;
    this._map = map;

    this.title = wX("QD TITLE");
    this.handler = new QuickDrawControl(map);
    this._container = container;
    this.type = QuickdrawButton.TYPE;

    this.button = this._createButton({
      title: this.title,
      container: container,
      buttonImage:
        window.plugin.wasabee.static.images.toolbar_quickdraw.default,
      callback: this.handler.enable,
      context: this.handler
    });

    this._endSubAction = {
      title: wX("QD BUTTON END"),
      text: wX("QD END"),
      callback: this.handler.disable,
      context: this.handler
    };
    this._qdModeSubAction = {
      title: "QuickDraw Mode",
      text: "Draws one layer per click",
      callback: this.toggleMode,
      context: this
    };
    this._slModeSubAction = {
      title: "Single Link Mode",
      text: "Draws one link per click",
      callback: this.toggleMode,
      context: this
    };

    this.actionsContainer = this._createSubActions([
      this._endSubAction
      // this._qdModeSubAction
    ]);
    // this should be automaticly detected
    this.actionsContainer.style.top = "52px";
    this._container.appendChild(this.actionsContainer);
  },

  toggleMode: function() {
    console.log(this);
    const from = this.handler.drawMode;
    if (from == "quickdraw") {
      console.log("switching to single link");
      this.handler.drawMode = "singlelink";
      this.actionsContainer = this._createSubActions([
        this._endSubAction,
        this._slModeSubAction
      ]);
    } else {
      console.log("switching to layers");
      this.handler.drawMode = "quickdraw";
      this.actionsContainer = this._createSubActions([
        this._endSubAction,
        this._qdModeSubAction
      ]);
    }
  }

  // Wupdate: function(container) { }
});

const QuickDrawControl = L.Handler.extend({
  initialize: function(map = window.map, options) {
    this._map = map;
    this._container = map._container;
    this.type = "QuickDrawControl";
    this.buttonName = "quickdrawButton";
    this.drawMode = "quickdraw";
    L.Handler.prototype.initialize.call(this, map, options);
    L.Util.extend(this.options, options);
  },

  enable: function() {
    if (this._enabled) return;
    L.Handler.prototype.enable.call(this);
    window.plugin.wasabee.buttons._modes[this.buttonName].enable();
  },

  disable: function() {
    if (!this._enabled) return;
    L.Handler.prototype.disable.call(this);
    window.plugin.wasabee.buttons._modes[this.buttonName].disable();
  },

  addHooks: function() {
    if (!this._map) return;
    L.DomUtil.disableTextSelection();

    this._tooltip = new WTooltip(this._map);
    L.DomEvent.addListener(this._container, "keyup", this._cancelDrawing, this);

    this._operation = getSelectedOperation();
    this._anchor1 = null;
    this._anchor2 = null;
    this._spinePortals = {};
    this._tooltip.updateContent(this._getTooltipText());
    this._throwOrder = this._operation.nextOrder;
    this._portalClickedHook = () => {
      QuickDrawControl.prototype._portalClicked.call(this);
    };
    window.addHook("portalSelected", this._portalClickedHook);
    this._map.on("mousemove", this._onMouseMove, this);
  },

  removeHooks: function() {
    if (!this._map) return;
    delete this._anchor1;
    delete this._anchor2;
    delete this._spinePortals;
    delete this._operation;

    L.DomUtil.enableTextSelection();
    this._tooltip.dispose();
    this._tooltip = null;
    L.DomEvent.removeListener(this._container, "keyup", this._cancelDrawing);

    window.removeHook("portalSelected", this._portalClickedHook);
    this._map.off("mousemove", this._onMouseMove, this);
  },

  _cancelDrawing: function(e) {
    if (e.keyCode === 27) {
      this.disable();
    }
  },

  _onMouseMove: function(e) {
    if (e.latlng) this._tooltip.updatePosition(e.latlng);
    L.DomEvent.preventDefault(e.originalEvent);
  },

  _getTooltipText: function() {
    if (!this._anchor1) return { text: wX("QDSTART") };
    if (!this._anchor2) return { text: wX("QDNEXT") };
    return { text: wX("QDCONT") };
  },

  _portalClicked: function() {
    const selectedPortal = WasabeePortal.getSelected();

    if (!selectedPortal) return;

    if (!this._anchor1) {
      this._throwOrder = this._operation.nextOrder;
      this._anchor1 = selectedPortal;
      this._tooltip.updateContent(this._getTooltipText());
      return;
    }
    if (!this._anchor2) {
      if (selectedPortal.id === this._anchor1.id) return;
      this._anchor2 = selectedPortal;
      this._operation.addLink(
        this._anchor1,
        this._anchor2,
        wX("QDBASE"),
        this._throwOrder++
      );
      this._tooltip.updateContent(this._getTooltipText());
      return;
    }

    localStorage["wasabee-anchor-1"] = JSON.stringify(this._anchor1);
    localStorage["wasabee-anchor-2"] = JSON.stringify(this._anchor2);

    if (selectedPortal.id in this._spinePortals) {
      return; //ignore duplicates
    } else {
      this._spinePortals[selectedPortal.id] = selectedPortal;
      this._operation.addLink(
        selectedPortal,
        this._anchor1,
        null,
        this._throwOrder++
      );
      this._operation.addLink(
        selectedPortal,
        this._anchor2,
        null,
        this._throwOrder++
      );
      this._tooltip.updateContent(this._getTooltipText());
    }
  }
});

export default QuickdrawButton;
