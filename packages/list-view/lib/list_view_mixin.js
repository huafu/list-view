require('list-view/list_view_helper');

var get = Ember.get, set = Ember.set,
min = Math.min, max = Math.max, floor = Math.floor,
ceil = Math.ceil,
forEach = Ember.ArrayPolyfills.forEach;

function addContentArrayObserver() {
  var content = get(this, 'content');
  if (content) {
    content.addArrayObserver(this);
  }
}

function removeAndDestroy(object){
  this.removeObject(object);
  object.destroy();
}

function syncChildViews(){
  Ember.run.once(this, '_syncChildViews');
}

function sortByContentIndex (viewOne, viewTwo){
  return get(viewOne, 'contentIndex') - get(viewTwo, 'contentIndex');
}

function notifyMutationListeners() {
  if (Ember.View.notifyMutationListeners) {
    Ember.run.once(Ember.View, 'notifyMutationListeners');
  }
}

var domManager = Ember.create(Ember.ContainerView.proto().domManager);

domManager.prepend = function(view, html) {
  view.$('.ember-list-container').prepend(html);
  notifyMutationListeners();
};

function syncListContainerSize(){
  var elementWidth, columnCount, containerWidth, element,
      elementHeight, rowCount, containerHeight;
  if ( get(this, 'isHorizontal') ) {
    // horizontal list
    elementHeight = get(this, 'elementHeight');
    rowCount = get(this, 'rowCount');
    containerHeight = elementHeight * rowCount;
    element = this.$('.ember-list-container');
    if (containerHeight && element) {
      element.css('height', containerHeight);
    }
  } else {
    // vertical list
    elementWidth = get(this, 'elementWidth');
    columnCount = get(this, 'columnCount');
    containerWidth = elementWidth * columnCount;
    element = this.$('.ember-list-container');
    if (containerWidth && element) {
      element.css('width', containerWidth);
    }
  }
}

function enableProfilingOutput() {
  function before(name, time, payload) {
    console.time(name);
  }

  function after (name, time, payload) {
    console.timeEnd(name);
  }

  if (Ember.ENABLE_PROFILING) {
    Ember.subscribe('view._scrollContentTo', {
      before: before,
      after: after
    });
    Ember.subscribe('view.updateContext', {
      before: before,
      after: after
    });
  }
}

/**
  @class Ember.ListViewMixin
  @namespace Ember
*/
Ember.ListViewMixin = Ember.Mixin.create({
  itemViewClass: Ember.ListItemView,
  emptyViewClass: Ember.View,
  classNames: ['ember-list-view'],
  classNameBindings: ['isHorizontal:horizontal:vertical'],
  attributeBindings: ['style'],
  domManager: domManager,
  scrollOffset: 0,
  bottomPadding: 0,
  rightPadding: 0,
  _lastEndingIndex: 0,
  paddingCount: 1,
  isHorizontal: false,

  totalSize: Ember.computed('isHorizontal', 'totalWidth', 'totalHeight', function() {
    if ( get(this, 'isHorizontal') ) {
      return get(this, 'totalWidth');
    }
    return get(this, 'totalHeight');
  }),

  size: Ember.computed('isHorizontal', 'width', 'height', function() {
    if ( get(this, 'isHorizontal') ) {
      return get(this, 'width');
    }
    return get(this, 'height');
  }),

  maxScrollOffset: Ember.computed('isHorizontal', 'maxScrollTop', 'maxScrollLeft', function() {
    if ( get(this, 'isHorizontal') ) {
      return get(this, 'maxScrollLeft');
    }
    return get(this, 'maxScrollTop');
  }),


  /**
    @private

    Setup a mixin.
    - adding observer to content array
    - creating child views based on height and length of the content array

    @method init
  */
  init: function() {
    this._super();
    this.on('didInsertElement', syncListContainerSize);
    this.columnCountDidChange();
    this.rowCountDidChange();
    this._syncChildViews();
    this._addContentArrayObserver();
  },

  _addContentArrayObserver: Ember.beforeObserver(function() {
    addContentArrayObserver.call(this);
  }, 'content'),

  /**
    Called on your view when it should push strings of HTML into a
    `Ember.RenderBuffer`.

    Adds a [div](https://developer.mozilla.org/en-US/docs/HTML/Element/div)
    with a required `ember-list-container` class.

    @method render
    @param {Ember.RenderBuffer} buffer The render buffer
  */
  render: function(buffer) {
    buffer.push('<div class="ember-list-container">');
    this._super(buffer);
    buffer.push('</div>');
  },

  willInsertElement: function() {
    if ( this.get('isHorizontal') ) {
      if (!this.get("width") || !this.get("columnWidth")) {
        throw new Error("An horizontal ListView must be created with a width and a columnWidth.");
      }
    } else {
      if (!this.get("height") || !this.get("rowHeight")) {
        throw new Error("A vertical ListView must be created with a height and a rowHeight.");
      }
    }
    this._super();
  },

  /**
    @private

    Sets inline styles of the view:
    - height
    - width
    - position
    - overflow
    - -webkit-overflow
    - overflow-scrolling

    Called while attributes binding.

    @property {Ember.ComputedProperty} style
  */
  style: Ember.computed('height', 'width', function() {
    var height, width, style, css;

    height = get(this, 'height');
    width = get(this, 'width');
    css = get(this, 'css');

    style = '';

    if (height) { style += 'height:' + height + 'px;'; }
    if (width)  { style += 'width:'  + width  + 'px;'; }

    for ( var rule in css ){
      if (css.hasOwnProperty(rule)) {
        style += rule + ':' + css[rule] + ';';
      }
    }

    return style;
  }),

  /**
    @private

    Performs visual scrolling. Is overridden in Ember.ListView.

    @method scrollTo
  */
  scrollTo: function(offset) {
    throw new Error('must override to perform the visual scroll and effectively delegate to _scrollContentTo');
  },

  /**
    @private

    Internal method used to force scroll position

    @method scrollTo
  */
  _scrollTo: Ember.K,

  /**
    @private
    @method _scrollContentTo
  */
  _scrollContentTo: function(offset) {
    var startingIndex, endingIndex,
        visibleEndingIndex, maxContentIndex,
        contentLength, scrollOffset;

    scrollOffset = max(0, offset);

    if (get(this, 'scrollOffset') === scrollOffset) {
      return;
    }

    // allow a visual overscroll, but don't scroll the content. As we are doing needless
    // recycyling, and adding unexpected nodes to the DOM.
    scrollOffset = Math.min(scrollOffset, (get(this, 'totalSize') - get(this, 'size')));

    Ember.instrument('view._scrollContentTo', {
      scrollOffset: scrollOffset,
      content: get(this, 'content'),
      startingIndex: this._startingIndex(),
      endingIndex: min(max(get(this, 'content.length') - 1, 0), this._startingIndex() + this._numChildViewsForViewport())
    }, function () {
      contentLength = get(this, 'content.length');
      set(this, 'scrollOffset', scrollOffset);

      maxContentIndex = max(contentLength - 1, 0);

      startingIndex = this._startingIndex();
      visibleEndingIndex = startingIndex + this._numChildViewsForViewport();

      endingIndex = min(maxContentIndex, visibleEndingIndex);

      this.trigger('scrollOffsetChanged', offset);

      if (startingIndex === this._lastStartingIndex &&
          endingIndex === this._lastEndingIndex) {
        return;
      }

      this._reuseChildren();

      this._lastStartingIndex = startingIndex;
      this._lastEndingIndex = endingIndex;
    }, this);
  },

  /**
    @private

    Computes the height for a `Ember.ListView` scrollable container div.
    You must specify `rowHeight` parameter for the height to be computed properly.

    @property {Ember.ComputedProperty} totalHeight
  */
  totalHeight: Ember.computed('content.length', 'rowHeight', 'columnCount', 'bottomPadding', 'isHorizontal', function() {
    var contentLength, rowHeight, columnCount, bottomPadding;
    if ( get(this, 'isHorizontal') ) return get(this, 'height');
    contentLength = get(this, 'content.length');
    rowHeight = get(this, 'rowHeight');
    columnCount = get(this, 'columnCount');
    bottomPadding = get(this, 'bottomPadding');

    return ((ceil(contentLength / columnCount)) * rowHeight) + bottomPadding;
  }),

  /**
    @private

    Computes the width for a `Ember.ListView` scrollable container div.
    You must specify `columnWidth` parameter for the width to be computed properly.

    @property {Ember.ComputedProperty} totalWidth
  */
  totalWidth: Ember.computed('content.length', 'columnWidth', 'rowCount', 'rightPadding', 'isHorizontal', function() {
    var contentLength, columnWidth, rowCount, rightPadding;
    if ( !get(this, 'isHorizontal') ) return get(this, 'width');
    contentLength = get(this, 'content.length');
    columnWidth = get(this, 'columnWidth');
    rowCount = get(this, 'rowCount');
    rightPadding = get(this, 'rightPadding');

    return ((ceil(contentLength / rowCount)) * columnWidth) + rightPadding;
  }),

  /**
    @private
    @method _prepareChildForReuse
  */
  _prepareChildForReuse: function(childView) {
    childView.prepareForReuse();
  },

  /**
    @private
    @method _reuseChildForContentIndex
  */
  _reuseChildForContentIndex: function(childView, contentIndex) {
    var content, newContext, position, enableProfiling;

    content = get(this, 'content');
    enableProfiling = get(this, 'enableProfiling');
    position = this.positionForIndex(contentIndex);
    set(childView, 'position', position);

    set(childView, 'contentIndex', contentIndex);

    if (enableProfiling) {
      Ember.instrument('view._reuseChildForContentIndex', position, function(){}, this);
    }

    newContext = content.objectAt(contentIndex);
    childView.updateContext(newContext);
  },

  /**
    @private
    @method positionForIndex
  */
  positionForIndex: function(index){
    var elementWidth, columnCount, rowHeight, y, x,
        elementHeight, rowCount, columnWidth;

    if ( get(this, 'isHorizontal') ) {
      // list is horizontal
      elementHeight = get(this, 'elementHeight') || 1;
      rowCount = get(this, 'rowCount');
      columnWidth = get(this, 'columnWidth');

      x = (columnWidth * floor(index/rowCount));
      y = (index % rowCount) * elementHeight;

      return {
        y: y,
        x: x
      };
    } else {
      // list is vertical
      elementWidth = get(this, 'elementWidth') || 1;
      columnCount = get(this, 'columnCount');
      rowHeight = get(this, 'rowHeight');

      y = (rowHeight * floor(index/columnCount));
      x = (index % columnCount) * elementWidth;

      return {
        y: y,
        x: x
      };
    }
  },

  /**
    @private
    @method _childViewCount
  */
  _childViewCount: function() {
    var contentLength, childViewCountForSize;

    contentLength = get(this, 'content.length');
    childViewCountForSize = this._numChildViewsForViewport();

    return min(contentLength, childViewCountForSize);
  },

  /**
    @private

    Returns a number of columns in the Ember.ListView (for grid layout).

    If you want to have a multi column layout, you need to specify both
    `width` and `elementWidth`.

    If no `elementWidth` is specified, it returns `1`. Otherwise, it will
    try to fit as many columns as possible for a given `width`.

    @property {Ember.ComputedProperty} columnCount
  */
  columnCount: Ember.computed('width', 'elementWidth', function() {
    var elementWidth, width, count;

    elementWidth = get(this, 'elementWidth');
    width = get(this, 'width');

    if (elementWidth) {
      count = floor(width / elementWidth);
    } else {
      count = 1;
    }

    return count;
  }),

  /**
    @private

    Fires every time column count is changed.

    @event columnCountDidChange
  */
  columnCountDidChange: Ember.observer(function(){
    var ratio, currentScrollOffset, proposedScrollOffset, maxScrollOffset,
        scrollOffset, lastColumnCount, newColumnCount;

    if ( get(this, 'isHorizontal') ) return;

    lastColumnCount = this._lastColumnCount;

    currentScrollOffset = get(this, 'scrollOffset');
    newColumnCount = get(this, 'columnCount');
    maxScrollOffset = get(this, 'maxScrollOffset');

    this._lastColumnCount = newColumnCount;

    if (lastColumnCount) {
      ratio = (lastColumnCount / newColumnCount);
      proposedScrollOffset = currentScrollOffset * ratio;
      scrollOffset = min(maxScrollOffset, proposedScrollOffset);

      this._scrollTo(scrollOffset);
      set(this, 'scrollOffset', scrollOffset);
    }

    if (arguments.length > 0) {
      // invoked by observer
      Ember.run.schedule('afterRender', this, syncListContainerSize);
    }
  }, 'columnCount', 'isHorizontal'),

  /**
    @private

    Computes max possible scrollTop value given the visible viewport
    and scrollable container div height.

    @property {Ember.ComputedProperty} maxScrollTop
  */
  maxScrollTop: Ember.computed('height', 'totalHeight', function(){
    var totalHeight, viewportHeight;

    totalHeight = get(this, 'totalHeight');
    viewportHeight = get(this, 'height');

    return max(0, totalHeight - viewportHeight);
  }),

  /**
    @private

    Returns a number of rows in the Ember.ListView (for grid layout and horizontal list view).

    If you want to have a multi row layout in horizontal list, you need to specify both
    `height` and `elementHeight`.

    If no `elementHeight` is specified, it returns `1`. Otherwise, it will
    try to fit as many columns as possible for a given `height`.

    @property {Ember.ComputedProperty} rowCount
  */
  rowCount: Ember.computed('height', 'elementHeight', function() {
    var elementHeight, height, count;

    elementHeight = get(this, 'elementHeight');
    height = get(this, 'height');

    if (elementHeight) {
      count = floor(height / elementHeight);
    } else {
      count = 1;
    }

    return count;
  }),

  /**
    @private

    Fires every time row count is changed.

    @event rowCountDidChange
  */
  rowCountDidChange: Ember.observer(function(){
    var ratio, currentScrollOffset, proposedScrollOffset, maxScrollOffset,
        scrollOffset, lastRowCount, newRowCount;

    if ( !get(this, 'isHorizontal') ) return;

    lastRowCount = this._lastRowCount;

    currentScrollOffset = get(this, 'scrollOffset');
    newRowCount = get(this, 'rowCount');
    maxScrollOffset = get(this, 'maxScrollLeft');

    this._lastRowCount = newRowCount;

    if (lastRowCount) {
      ratio = (lastRowCount / newRowCount);
      proposedScrollOffset = currentScrollOffset * ratio;
      scrollOffset = min(maxScrollOffset, proposedScrollOffset);

      this._scrollTo(scrollOffset);
      set(this, 'scrollOffset', scrollOffset);
    }

    if (arguments.length > 0) {
      // invoked by observer
      Ember.run.schedule('afterRender', this, syncListContainerSize);
    }
  }, 'rowCount', 'isHorizontal'),

  /**
    @private

    Computes max possible scrollLeft value given the visible viewport
    and scrollable container div width.

    @property {Ember.ComputedProperty} maxScrollLeft
  */
  maxScrollLeft: Ember.computed('width', 'totalWidth', function(){
    var totalWidth, viewportWidth;

    totalWidth = get(this, 'totalWidth');
    viewportWidth = get(this, 'width');

    return max(0, totalWidth - viewportWidth);
  }),

  /**
    @private

    Computes the number of views that would fit in the viewport area.
    You must specify `height` and `rowHeight` parameters for the number of
    views to be computed properly (or `width` and `columnWidth` in case of horizontal list)

    @method _numChildViewsForViewport
  */
  _numChildViewsForViewport: function() {
    var height, rowHeight, paddingCount, columnCount,
        width, columnWidth, rowCount;
    if ( get(this, 'isHorizontal') ) {
      // horizontal mode
      width = get(this, 'width');
      columnWidth = get(this, 'columnWidth');
      paddingCount = get(this, 'paddingCount');
      rowCount = get(this, 'rowCount');
      return (ceil(width / columnWidth) * rowCount) + (paddingCount * rowCount);
    } else {
      // vertical mode
      height = get(this, 'height');
      rowHeight = get(this, 'rowHeight');
      paddingCount = get(this, 'paddingCount');
      columnCount = get(this, 'columnCount');
      return (ceil(height / rowHeight) * columnCount) + (paddingCount * columnCount);
    }
  },

  /**
    @private

    Computes the starting index of the item views array.
    Takes `scrollOffset` property of the element into account.

    Is used in `_syncChildViews`.

    @method _startingIndex
  */
  _startingIndex: function() {
    var scrollOffset, rowHeight, columnCount, calculatedStartingIndex,
        contentLength, largestStartingIndex, columnWidth, rowCount;
    contentLength = get(this, 'content.length');
    scrollOffset = get(this, 'scrollOffset');
    if ( get(this, 'isHorizontal') ) {
      // horizontal list
      columnWidth = get(this, 'columnWidth');
      rowCount = get(this, 'rowCount');
      calculatedStartingIndex = floor(scrollOffset / columnWidth) * rowCount;
      largestStartingIndex = max(contentLength - 1, 0);
      return max(0, min(calculatedStartingIndex, largestStartingIndex));
    } else {
      // vertical list
      rowHeight = get(this, 'rowHeight');
      columnCount = get(this, 'columnCount');
      calculatedStartingIndex = floor(scrollOffset / rowHeight) * columnCount;
      largestStartingIndex = max(contentLength - 1, 0);
      return max(0, min(calculatedStartingIndex, largestStartingIndex));
    }
  },

  /**
    @private
    @event contentWillChange
  */
  contentWillChange: Ember.beforeObserver(function() {
    var content;

    content = get(this, 'content');

    if (content) {
      content.removeArrayObserver(this);
    }
  }, 'content'),

  /**),
    @private
    @event contentDidChange
  */
  contentDidChange: Ember.observer(function() {
    addContentArrayObserver.call(this);
    syncChildViews.call(this);
  }, 'content'),

  /**
    @private
    @property {Function} needsSyncChildViews
  */
  needsSyncChildViews: Ember.observer(syncChildViews, 'height', 'width', 'columnCount', 'rowCount', 'isHorizontal'),

  /**
    @private

    Returns a new item view. Takes `contentIndex` to set the context
    of the returned view properly.

    @param {Number} contentIndex item index in the content array
    @method _addItemView
  */
  _addItemView: function(contentIndex){
    var itemViewClass, childView;

    itemViewClass = get(this, 'itemViewClass');
    childView = this.createChildView(itemViewClass);

    this.pushObject(childView);
   },

  /**
    @private

    Intelligently manages the number of childviews.

    @method _syncChildViews
   **/
  _syncChildViews: function(){
    var startingIndex, childViewCount,
        numberOfChildViews, numberOfChildViewsNeeded,
        childViews, count, delta, contentIndex;

    if (get(this, 'isDestroyed') || get(this, 'isDestroying')) {
      return;
    }

    childViewCount = this._childViewCount();
    childViews = this.positionOrderedChildViews();

    startingIndex = this._startingIndex();

    numberOfChildViewsNeeded = childViewCount;
    numberOfChildViews = childViews.length;

    delta = numberOfChildViewsNeeded - numberOfChildViews;

    if (delta === 0) {
      // no change
    } else if (delta > 0) {
      // more views are needed
      contentIndex = this._lastEndingIndex;

      for (count = 0; count < delta; count++, contentIndex++) {
        this._addItemView(contentIndex);
      }

    } else {
      // less views are needed
      forEach.call(
        childViews.splice(numberOfChildViewsNeeded, numberOfChildViews),
        removeAndDestroy,
        this
      );
    }

    this._reuseChildren();

    this._lastStartingIndex = startingIndex;
    this._lastEndingIndex   = this._lastEndingIndex + delta;
  },

  /**
    @private
    @method _reuseChildren
  */
  _reuseChildren: function(){
    var childViews, childViewsLength,
        startingIndex, childView,
        contentIndex, visibleEndingIndex,
        contentIndexEnd;

    childViews = this.getReusableChildViews();
    childViewsLength =  childViews.length;

    startingIndex = this._startingIndex();
    visibleEndingIndex = startingIndex + this._numChildViewsForViewport();

    contentIndexEnd = min(visibleEndingIndex, startingIndex + childViewsLength);

    for (contentIndex = startingIndex; contentIndex < contentIndexEnd; contentIndex++) {
      childView = childViews[contentIndex % childViewsLength];
      this._reuseChildForContentIndex(childView, contentIndex);
    }
  },

  /**
    @private
    @method getReusableChildViews
  */
  getReusableChildViews: function() {
    return this._childViews;
  },

  /**
    @private
    @method positionOrderedChildViews
  */
  positionOrderedChildViews: function() {
    return this.getReusableChildViews().sort(sortByContentIndex);
  },

  arrayWillChange: Ember.K,

  /**
    @private
    @event arrayDidChange
  */
  // TODO: refactor
  arrayDidChange: function(content, start, removedCount, addedCount) {
    var index, contentIndex;

    if (this.state === 'inDOM') {
      // ignore if all changes are out of the visible change
      if( start >= this._lastStartingIndex || start < this._lastEndingIndex) {
        index = 0;
        // ignore all changes not in the visible range
        // this can re-position many, rather then causing a cascade of re-renders
        forEach.call(
          this.positionOrderedChildViews(),
          function(childView) {
            contentIndex = this._lastStartingIndex + index;
            this._reuseChildForContentIndex(childView, contentIndex);
            index++;
          },
          this
        );
      }

      syncChildViews.call(this);
    }
  }
});
