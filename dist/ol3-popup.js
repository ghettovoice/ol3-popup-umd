(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['openlayers'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        
        module.exports = factory(require('openlayers'));
    } else {
        // Browser globals (root is window)
        root.ol.Overlay.Popup = factory(root.ol);
    }
}(this, function(ol) {

/**
 * Extended OpenLayers 3 Popup Overlay.
 * See [the examples](./examples) for usage. Styling can be done via CSS.
 *
 */
ol.Overlay.Popup = (function(ol) {
    /**
     * @typedef {Object} PopupEventType
     * @property {string} SHOW
     * @property {string} HIDE
     */
    var PopupEventType = {
        SHOW: "show",
        HIDE: "hide"
    };

    /**
     * @constructs
     * @extends ol.Overlay
     * @param {Object} opt_options Overlay options, extends olx.OverlayOptions adding:
     *                              **`panMapIfOutOfView`** `Boolean` - Should the
     *                              map be panned so that the popup is entirely
     *                              within view.
     */
    function Popup(opt_options) {
        var options = opt_options || {};

        /**
         * @type {boolean}
         * @protected
         */
        this.panMapIfOutOfView = options.panMapIfOutOfView;
        if (this.panMapIfOutOfView === undefined) {
            this.panMapIfOutOfView = true;
        }

        /**
         * @type {number}
         * @protected
         */
        this.ani = options.ani;
        if (this.ani === undefined) {
            this.ani = ol.animation.pan;
        }

        /**
         * @type {Object}
         * @protected
         */
        this.ani_opts = options.ani_opts;
        if (this.ani_opts === undefined) {
            this.ani_opts = { "duration": 250 };
        }
        /**
         * @type {Element}
         * @protected
         */
        this.container = document.createElement("div");
        this.container.className = "ol-popup";

        /**
         * @type {Element}
         * @protected
         */
        this.closer = document.createElement("a");
        this.closer.className = "ol-popup-closer";
        this.closer.href = "#";
        this.container.appendChild(this.closer);

        var that = this;

        this.closer.addEventListener("click", function(evt) {
            evt.preventDefault();
            evt.stopPropagation();

            that.hide();
        });

        ["click", "focus"].forEach(function(name) {
            this.container.addEventListener(name, function() {
                that.bringToFront();
            });
        }, this);

        /**
         * @type {Element}
         * @protected
         */
        this.content = document.createElement("div");
        this.content.className = "ol-popup-content";
        this.container.appendChild(this.content);

        // Apply workaround to enable scrolling of content div on touch devices
        Popup.enableTouchScroll_(this.content);

        if (options.content) {
            this.setContent(options.content);
        }

        options.element = this.container;

        ol.Overlay.call(this, options);
    }

    ol.inherits(Popup, ol.Overlay);

    /**
     * @desc Sets popup inner content.
     * @param {string|Element} content
     * @returns {Popup}
     */
    Popup.prototype.setContent = function(content) {
        if (content  instanceof Element) {
            this.content.appendChild(content);
        } else if (typeof content === "string") {
            this.content.innerHTML = content;
        }
        return this;
    };

    /**
     * @desc Set the map to be associated with this overlay.
     * @param {ol.Map|undefined} map The map that the overlay is part of.
     * @observable
     */
    Popup.prototype.setMap = function(map) {
        ol.Overlay.prototype.setMap.call(this, map);

        if (map != null) {
            this.bringToFront();
        }
    };

    /**
     * @desc Returns inner content.
     * @returns {Element}
     */
    Popup.prototype.getContent = function() {
        return this.content;
    };

    /**
     * @desc Show the popup.
     * @param {ol.Coordinate} coord
     * @param {string|Element} [content]
     * @returns {Popup}
     */
    Popup.prototype.show = function(coord, content) {
        if (content) {
            this.setContent(content);
        }
        this.setPosition(coord);
        this.container.style.display = "block";
        if (this.panMapIfOutOfView) {
            this.panIntoView(coord);
        }
        // currently ol3 doesn't exports dispatchEvent method
        //this.dispatchEvent(PopupEventType.SHOW);
        this.set("visibility", true);
        return this;
    };

    /**
     * @param {ol.Coordinate} coord
     * @returns {ol.Coordinate|undefined}
     * @private
     */
    Popup.prototype.panIntoView = function(coord) {

        var popSize = {
                width: this.getElement().clientWidth + 20,
                height: this.getElement().clientHeight + 20
            },
            mapSize = this.getMap().getSize();

        var tailHeight      = 20,
            tailOffsetLeft  = 60,
            tailOffsetRight = popSize.width - tailOffsetLeft,
            popOffset       = this.getOffset(),
            popPx           = this.getMap().getPixelFromCoordinate(coord);

        var fromLeft  = (popPx[0] - tailOffsetLeft),
            fromRight = mapSize[0] - (popPx[0] + tailOffsetRight);

        var fromTop    = popPx[1] - popSize.height + popOffset[1],
            fromBottom = mapSize[1] - (popPx[1] + tailHeight) - popOffset[1];

        var center = this.getMap().getView().getCenter(),
            px     = this.getMap().getPixelFromCoordinate(center);

        if (fromRight < 0) {
            px[0] -= fromRight;
        } else if (fromLeft < 0) {
            px[0] += fromLeft;
        }

        if (fromTop < 0) {
            px[1] += fromTop;
        } else if (fromBottom < 0) {
            px[1] -= fromBottom;
        }

        if (this.ani && this.ani_opts) {
            this.ani_opts.source = center;
            this.getMap().beforeRender(this.ani(this.ani_opts));
        }

        this.getMap().getView().setCenter(this.getMap().getCoordinateFromPixel(px));

        return this.getMap().getView().getCenter();
    };

    /**
     * @desc Hide the popup.
     * @returns {Popup}
     */
    Popup.prototype.hide = function() {
        this.container.style.display = "none";
        this.closer.blur();
        //this.dispatchEvent(PopupEventType.HIDE);
        this.set("visibility", false);
        return this;
    };

    /**
     * @desc Show on top of other popups.
     * @returns {Popup}
     */
    Popup.prototype.bringToFront = function() {
        var container         = this.container.parentNode,
            overlaysContainer = container.parentNode,
            lastOverlay       = (/** @type {Element} */[].slice.call(overlaysContainer.querySelectorAll(".ol-overlay-container")).pop());

        if (lastOverlay && lastOverlay !== container) {
            overlaysContainer.insertBefore(container, lastOverlay.nextSibling);
        }

        return this;
    };

    return Popup;
}(ol));


return ol.Overlay.Popup;

}));
