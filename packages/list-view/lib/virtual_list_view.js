/*global Scroller*/
require('list-view/list_view_mixin');
require('list-view/list_view_helper');
require('list-view/virtual_list_scroller_events');

var max = Math.max, get = Ember.get, set = Ember.set;

function updateScrollerDimensions(target) {
  var width, height, totalHeight, totalWidth, horiz;

  target = target || this;

  horiz = get(target, 'isHorizontal');
  width = get(target, 'width');
  height = get(target, 'height');
  totalHeight = horiz ? height : get(target, 'totalHeight');
  totalWidth = horiz ? get(target, 'totalWidth') : width;

  target.scroller.setDimensions(width, height, totalWidth, totalHeight);
  target.trigger('scrollerDimensionsDidChange');
}

/**
  VirtualListView

  @class VirtualListView
  @namespace Ember
*/
Ember.VirtualListView = Ember.ContainerView.extend(Ember.ListViewMixin, Ember.VirtualListScrollerEvents, {
  _isScrolling: false,
  _mouseWheel: null,
  css: {
    position: 'relative',
    overflow: 'hidden'
  },

  init: function(){
    this._super();
    this.setupScroller();
    this.setupPullToRefresh();
  },
  _scrollerOffset: 0,
  applyTransform: Ember.ListViewHelper.apply3DTransform,

  setupScroller: function(){
    var view, isHoriz;

    view = this;
    isHoriz = this.get('isHorizontal');

    view.scroller = new Scroller(function(left, top, zoom) {
      if (view.state !== 'inDOM') { return; }

      if (view.listContainerElement) {
        if ( isHoriz ) {
          view.applyTransform(view.listContainerElement, -left, 0);
          view._scrollerOffset = left;
          view._scrollContentTo(left);
        } else {
          view.applyTransform(view.listContainerElement, 0, -top);
          view._scrollerTop = top;
          view._scrollContentTo(top);
        }
      }
    }, {
      scrollingY: !isHoriz,
      scrollingX: isHoriz,
      scrollingComplete: function(){
        view.trigger('scrollingDidComplete');
      }
    });

    view.trigger('didInitializeScroller');
    updateScrollerDimensions(view);
  },
  setupPullToRefresh: function() {
    if (!this.pullToRefreshViewClass) { return; }
    this._insertPullToRefreshView();
    this._activateScrollerPullToRefresh();
  },
  _insertPullToRefreshView: function(){
    this.pullToRefreshView = this.createChildView(this.pullToRefreshViewClass);
    this.insertAt(0, this.pullToRefreshView);
    var offset, view = this, isHoriz = view.get('isHorizontal');
    this.pullToRefreshView.on('didInsertElement', function() {
      offset = -1 * view.pullToRefreshViewSize;
      view.applyTransform(this.get('element'), isHoriz ? pullToRefreshViewSize : 0, isHoriz ? 0 : pullToRefreshViewSize);
    });
  },
  _activateScrollerPullToRefresh: function(){
    var view = this;
    function activatePullToRefresh(){
      view.pullToRefreshView.set('active', true);
      view.trigger('activatePullToRefresh');
    }
    function deactivatePullToRefresh() {
      view.pullToRefreshView.set('active', false);
      view.trigger('deactivatePullToRefresh');
    }
    function startPullToRefresh() {
      view.pullToRefreshView.set('refreshing', true);

      function finishRefresh(){
        if (view && !view.get('isDestroyed') && !view.get('isDestroying')) {
          view.scroller.finishPullToRefresh();
          view.pullToRefreshView.set('refreshing', false);
        }
      }
      view.startRefresh(finishRefresh);
    }
    this.scroller.activatePullToRefresh(
      this.pullToRefreshViewSize,
      activatePullToRefresh,
      deactivatePullToRefresh,
      startPullToRefresh
    );
  },

  getReusableChildViews: function(){
    var firstView = this._childViews[0];
    if (firstView && firstView === this.pullToRefreshView) {
      return this._childViews.slice(1);
    } else {
      return this._childViews;
    }
  },

  scrollerDimensionsNeedToChange: Ember.observer(function() {
    Ember.run.once(this, updateScrollerDimensions);
  }, 'width', 'height', 'totalHeight', 'totalWidth'),

  didInsertElement: function() {
    this.listContainerElement = this.$('> .ember-list-container')[0];
  },

  willBeginScroll: function(touches, timeStamp) {
    this._isScrolling = false;
    this.trigger('scrollingDidStart');

    this.scroller.doTouchStart(touches, timeStamp);
  },

  continueScroll: function(touches, timeStamp) {
    var startingScrollOffset, endingScrollOffset, event;

    if (this._isScrolling) {
      this.scroller.doTouchMove(touches, timeStamp);
    } else {
      startingScrollOffset = this._scrollerOffset;

      this.scroller.doTouchMove(touches, timeStamp);

      endingScrollOffset = this._scrollerOffset;

      if (startingScrollOffset !== endingScrollOffset) {
        event = Ember.$.Event("scrollerstart");
        Ember.$(touches[0].target).trigger(event);

        this._isScrolling = true;
      }
    }
  },

  endScroll: function(timeStamp) {
    this.scroller.doTouchEnd(timeStamp);
  },

  // api
  scrollTo: function(offset, animate) {
    var isHoriz = get(this, 'isHorizontal');
    if (animate === undefined) {
      animate = true;
    }

    this.scroller.scrollTo(isHoriz ? offset : 0, isHoriz ? 0 : offset, animate, 1);
  },

  // events
  mouseWheel: function(e){
    var inverted, delta, candidatePosition, isHoriz = get(this, 'isHorizontal');

    inverted = e.webkitDirectionInvertedFromDevice;
    delta = e[isHoriz ? 'wheelDeltaX' : 'wheelDeltaY'] * (inverted ? 0.8 : -0.8);
    candidatePosition = this.scroller[isHoriz ? '__scrollLeft' : '__scrollTop'] + delta;

    if ((candidatePosition >= 0) && (candidatePosition <= this.scroller[isHoriz ? '__maxScrollLeft' : '__maxScrollTop'])) {
      this.scroller.scrollBy(isHoriz ? delta : 0, isHoriz ? 0 : delta, true);
    }

    return false;
  }
});
