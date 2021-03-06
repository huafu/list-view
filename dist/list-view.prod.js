(function() {
var get = Ember.get, set = Ember.set;

function samePosition(a, b) {
  return a && b && a.x === b.x && a.y === b.y;
}

function positionElement() {
  var element, position, _position;

  Ember.instrument('view.updateContext.positionElement', this, function() {
    element = get(this, 'element');
    position = get(this, 'position');
    _position = this._position;

    if (!position || !element) { return; }

    // TODO: avoid needing this by avoiding unnecessary
    // calls to this method in the first place
    if (samePosition(position, _position)) { return; }
    this._parentView.applyTransform(element, position.x, position.y);

    this._position = position;
  }, this);
}

Ember.ListItemViewMixin = Ember.Mixin.create({
  init: function(){
    this._super();
    this.one('didInsertElement', positionElement);
  },
  classNames: ['ember-list-item-view'],
  _position: null,
  _positionDidChange: Ember.observer(positionElement, 'position'),
  _positionElement: positionElement
});

})();



(function() {
var get = Ember.get, set = Ember.set;

var backportedInnerString = function(buffer) {
  var content = [], childBuffers = buffer.childBuffers;

  Ember.ArrayPolyfills.forEach.call(childBuffers, function(buffer) {
    var stringy = typeof buffer === 'string';
    if (stringy) {
      content.push(buffer);
    } else {
      buffer.array(content);
    }
  });

  return content.join('');
};

function willInsertElementIfNeeded(view) {
  if (view.willInsertElement) {
    view.willInsertElement();
  }
}

function didInsertElementIfNeeded(view) {
  if (view.didInsertElement) {
    view.didInsertElement();
  }
}

function rerender() {
  var element, buffer, context, hasChildViews;
  element = get(this, 'element');

  if (!element) { return; }

  context = get(this, 'context');

  // releases action helpers in contents
  // this means though that the ListViewItem itself can't use classBindings or attributeBindings
  // need support for rerender contents in ember
  this.triggerRecursively('willClearRender');

  if (this.lengthAfterRender > this.lengthBeforeRender) {
    this.clearRenderedChildren();
    this._childViews.length = this.lengthBeforeRender; // triage bug in ember
  }

  if (context) {
    buffer = Ember.RenderBuffer();
    buffer = this.renderToBuffer(buffer);

    // check again for childViews, since rendering may have added some
    hasChildViews = this._childViews.length > 0;

    if (hasChildViews) {
      this.invokeRecursively(willInsertElementIfNeeded, false);
    }

    element.innerHTML = buffer.innerString ? buffer.innerString() : backportedInnerString(buffer);

    set(this, 'element', element);

    this.transitionTo('inDOM');

    if (hasChildViews) {
      this.invokeRecursively(didInsertElementIfNeeded, false);
    }
  } else {
    element.innerHTML = ''; // when there is no context, this view should be completely empty
  }
}

/**
  The `Ember.ListViewItem` view class renders a
  [div](https://developer.mozilla.org/en/HTML/Element/div) HTML element
  with `ember-list-item-view` class. It allows you to specify a custom item
  handlebars template for `Ember.ListView`.

  Example:

  ```handlebars
  <script type="text/x-handlebars" data-template-name="row_item">
    {{name}}
  </script>
  ```

  ```javascript
  App.ListView = Ember.ListView.extend({
    height: 500,
    rowHeight: 20,
    itemViewClass: Ember.ListItemView.extend({templateName: "row_item"})
  });
  ```

  @extends Ember.View
  @class ListItemView
  @namespace Ember
*/
Ember.ListItemView = Ember.View.extend(Ember.ListItemViewMixin, {
  updateContext: function(newContext){
    var context = get(this, 'context');
    Ember.instrument('view.updateContext.render', this, function() {
      if (context !== newContext) {
        this.set('context', newContext);
        if (newContext instanceof Ember.ObjectController) {
          this.set('controller', newContext);
        }
      }
    }, this);
  },
  rerender: function () { Ember.run.scheduleOnce('render', this, rerender); },
  _contextDidChange: Ember.observer(rerender, 'context', 'controller')
});

})();



(function() {
var get = Ember.get, set = Ember.set;

Ember.ReusableListItemView = Ember.View.extend(Ember.ListItemViewMixin, {
  init: function(){
    this._super();
    this.set('context', Ember.ObjectProxy.create());
  },
  isVisible: Ember.computed('context.content', function(){
    return !!this.get('context.content');
  }),
  updateContext: function(newContext){
    var context = get(this, 'context.content');
    if (context !== newContext) {
      if (this.state === 'inDOM') {
        this.prepareForReuse(newContext);
      }
      set(this, 'context.content', newContext);
    }
  },
  prepareForReuse: Ember.K
});

})();



(function() {
var el = document.createElement('div'), style = el.style;

var propPrefixes = ['Webkit', 'Moz', 'O', 'ms'];

function testProp(prop) {
  if (prop in style) return prop;
  var uppercaseProp = prop.charAt(0).toUpperCase() + prop.slice(1);
  for (var i=0; i<propPrefixes.length; i++) {
    var prefixedProp = propPrefixes[i] + uppercaseProp;
    if (prefixedProp in style) {
      return prefixedProp;
    }
  }
  return null;
}

var transformProp = testProp('transform');
var perspectiveProp = testProp('perspective');

var supports2D = transformProp !== null;
var supports3D = perspectiveProp !== null;

Ember.ListViewHelper = {
  transformProp: transformProp,
  applyTransform: (function(){
    if (supports2D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate(' + x + 'px, ' + y + 'px)';
      };
    } else {
      return function(element, x, y){
        element.style.top  = y + 'px';
        element.style.left = x + 'px';
      };
    }
  })(),
  apply3DTransform: (function(){
    if (supports3D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      };
    } else if (supports2D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate(' + x + 'px, ' + y + 'px)';
      };
    } else {
      return function(element, x, y){
        element.style.top  = y + 'px';
        element.style.left = x + 'px';
      };
    }
  })()
};

})();



(function() {
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

})();



(function() {
var get = Ember.get, set = Ember.set;

/**
  The `Ember.ListView` view class renders a
  [div](https://developer.mozilla.org/en/HTML/Element/div) HTML element,
  with `ember-list-view` class.

  The context of each item element within the `Ember.ListView` are populated
  from the objects in the `Element.ListView`'s `content` property.

  ### `content` as an Array of Objects

  The simplest version of an `Ember.ListView` takes an array of object as its
  `content` property. The object will be used as the `context` each item element
  inside the rendered `div`.

  Example:

  ```javascript
  App.contributors = [{ name: 'Stefan Penner' }, { name: 'Alex Navasardyan' }, { name: 'Rey Cohen'}];
  ```

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50}}
    {{name}}
  {{/collection}}
  ```

  Would result in the following HTML:

  ```html
   <div id="ember181" class="ember-view ember-list-view" style="height:500px;width:500px;position:relative;overflow:scroll;-webkit-overflow-scrolling:touch;overflow-scrolling:touch;">
    <div class="ember-list-container">
      <div id="ember186" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 0px, 0);">
        <script id="metamorph-0-start" type="text/x-placeholder"></script>Stefan Penner<script id="metamorph-0-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember187" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 50px, 0);">
        <script id="metamorph-1-start" type="text/x-placeholder"></script>Alex Navasardyan<script id="metamorph-1-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember188" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 100px, 0);">
        <script id="metamorph-2-start" type="text/x-placeholder"></script>Rey Cohen<script id="metamorph-2-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember189" class="ember-view ember-list-scrolling-view" style="height: 150px"></div>
    </div>
  </div>
  ```

  By default `Ember.ListView` provides support for `height`,
  `rowHeight`, `width`, `elementWidth`, `scrollOffset` parameters.

  Note, that `height` and `rowHeight` are required parameters.

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50}}
    {{name}}
  {{/collection}}
  ```

  If you would like to have multiple columns in your view layout, you can
  set `width` and `elementWidth` parameters respectively.

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50 width=500 elementWidth=80}}
    {{name}}
  {{/collection}}
  ```

  ### extending `Ember.ListView`

  Example:

  ```handlebars
  {{view App.ListView contentBinding="content"}}

  <script type="text/x-handlebars" data-template-name="row_item">
    {{name}}
  </script>
  ```

  ```javascript
  App.ListView = Ember.ListView.extend({
    height: 500,
    width: 500,
    elementWidth: 80,
    rowHeight: 20,
    itemViewClass: Ember.ListItemView.extend({templateName: "row_item"})
  });
  ```

  @extends Ember.ContainerView
  @class ListView
  @namespace Ember
*/
Ember.ListView = Ember.ContainerView.extend(Ember.ListViewMixin, {
  css: {
    position: 'relative',
    overflow: 'scroll',
    '-webkit-overflow-scrolling': 'touch',
    'overflow-scrolling': 'touch'
  },

  applyTransform: Ember.ListViewHelper.applyTransform,

  _scrollTo: function(scrollOffset) {
    var element = get(this, 'element');

    if (element) { element[get(this, 'isHorizontal') ? 'scrollLeft' : 'scrollTop'] = scrollOffset; }
  },

  didInsertElement: function() {
    var that, element;

    that = this;
    element = get(this, 'element');

    this._updateScrollableSize();

    this._scroll = function(e) { that.scroll(e); };

    Ember.$(element).on('scroll', this._scroll);
  },

  willDestroyElement: function() {
    var element;

    element = get(this, 'element');

    Ember.$(element).off('scroll', this._scroll);
  },

  scroll: function(e) {
    Ember.run(this, this.scrollTo, e.target[get(this, 'isHorizontal') ? 'scrollLeft' : 'scrollTop']);
  },

  scrollTo: function(offset){
    this._scrollTo(offset);
    this._scrollContentTo(offset);
  },

  totalSizeDidChange: Ember.observer(function () {
    Ember.run.scheduleOnce('afterRender', this, this._updateScrollableSize);
  }, 'totalSize'),

  _updateScrollableSize: function () {
    var height = '', width = '';
    if (this.state === 'inDOM') {
      if ( get(this, 'isHorizontal') ) {
        width = get(this, 'totalSize');
      } else {
        height = get(this, 'totalSize');
      }
      this.$('.ember-list-container').css({
        height: height,
        width: width
      });
    }
  }
});

})();



(function() {
var fieldRegex = /input|textarea|select/i,
  hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof window.DocumentTouch,
  handleStart, handleMove, handleEnd, handleCancel,
  startEvent, moveEvent, endEvent, cancelEvent;
if (hasTouch) {
  startEvent = 'touchstart';
  handleStart = function (e) {
    var touch = e.touches[0],
      target = touch && touch.target;
    // avoid e.preventDefault() on fields
    if (target && fieldRegex.test(target.tagName)) {
      return;
    }
    bindWindow(this.scrollerEventHandlers);
    this.willBeginScroll(e.touches, e.timeStamp);
    e.preventDefault();
  };
  moveEvent = 'touchmove';
  handleMove = function (e) {
    this.continueScroll(e.touches, e.timeStamp);
  };
  endEvent = 'touchend';
  handleEnd = function (e) {
    // if we didn't end up scrolling we need to
    // synthesize click since we did e.preventDefault()
    // on touchstart
    if (!this._isScrolling) {
      synthesizeClick(e);
    }
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
  cancelEvent = 'touchcancel';
  handleCancel = function (e) {
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
} else {
  startEvent = 'mousedown';
  handleStart = function (e) {
    if (e.which !== 1) return;
    var target = e.target;
    // avoid e.preventDefault() on fields
    if (target && fieldRegex.test(target.tagName)) {
      return;
    }
    bindWindow(this.scrollerEventHandlers);
    this.willBeginScroll([e], e.timeStamp);
    e.preventDefault();
  };
  moveEvent = 'mousemove';
  handleMove = function (e) {
    this.continueScroll([e], e.timeStamp);
  };
  endEvent = 'mouseup';
  handleEnd = function (e) {
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
  cancelEvent = 'mouseout';
  handleCancel = function (e) {
    if (e.relatedTarget) return;
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
}

function handleWheel(e) {
  this.mouseWheel(e);
  e.preventDefault();
}

function bindElement(el, handlers) {
  el.addEventListener(startEvent, handlers.start, false);
  el.addEventListener('mousewheel', handlers.wheel, false);
}

function unbindElement(el, handlers) {
  el.removeEventListener(startEvent, handlers.start, false);
  el.removeEventListener('mousewheel', handlers.wheel, false);
}

function bindWindow(handlers) {
  window.addEventListener(moveEvent, handlers.move, true);
  window.addEventListener(endEvent, handlers.end, true);
  window.addEventListener(cancelEvent, handlers.cancel, true);
}

function unbindWindow(handlers) {
  window.removeEventListener(moveEvent, handlers.move, true);
  window.removeEventListener(endEvent, handlers.end, true);
  window.removeEventListener(cancelEvent, handlers.cancel, true);
}

Ember.VirtualListScrollerEvents = Ember.Mixin.create({
  init: function() {
    this.on('didInsertElement', this, 'bindScrollerEvents');
    this.on('willDestroyElement', this, 'unbindScrollerEvents');
    this.scrollerEventHandlers = {
      start: bind(this, handleStart),
      move: bind(this, handleMove),
      end: bind(this, handleEnd),
      cancel: bind(this, handleCancel),
      wheel: bind(this, handleWheel)
    };
    return this._super();
  },
  bindScrollerEvents: function() {
    var el = this.get('element'),
      handlers = this.scrollerEventHandlers;
    bindElement(el, handlers);
  },
  unbindScrollerEvents: function() {
    var el = this.get('element'),
      handlers = this.scrollerEventHandlers;
    unbindElement(el, handlers);
    unbindWindow(handlers);
  }
});

function bind(view, handler) {
  return function (evt) {
    handler.call(view, evt);
  };
}

function synthesizeClick(e) {
  var point = e.changedTouches[0],
    target = point.target,
    ev;
  if (target && fieldRegex.test(target.tagName)) {
    ev = document.createEvent('MouseEvents');
    ev.initMouseEvent('click', true, true, e.view, 1, point.screenX, point.screenY, point.clientX, point.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, null);
    return target.dispatchEvent(ev);
  }
  return void 0;
}

})();



(function() {
/*global Scroller*/
var max = Math.max, get = Ember.get, set = Ember.set;

function updateScrollerDimensions(target) {
  var width, height, totalHeight, totalWidth, isHoriz;

  target = target || this;

  isHoriz = get(target, 'isHorizontal');
  width = get(target, 'width');
  height = get(target, 'height');
  totalHeight = isHoriz ? height : get(target, 'totalHeight');
  totalWidth = isHoriz ? get(target, 'totalWidth') : width;

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
        } else {
          view.applyTransform(view.listContainerElement, 0, -top);
          view._scrollerOffset = top;
        }
        view._scrollContentTo(view._scrollerOffset);
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
      view.applyTransform(this.get('element'), isHoriz ? offset : 0, isHoriz ? 0 : offset);
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
  }, 'width', 'height', 'totalHeight', 'totalWidth', 'isHorizontal'),

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
    delta = e[isHoriz ? 'wheelDeltaX' : 'wheelDeltaY'];
    if ( isHoriz && !delta ) delta = e.wheelDeltaY;
    delta = delta * (inverted ? 0.8 : -0.8);
    candidatePosition = this.scroller[isHoriz ? '__scrollLeft' : '__scrollTop'] + delta;

    if ((candidatePosition >= 0) && (candidatePosition <= this.scroller[isHoriz ? '__maxScrollLeft' : '__maxScrollTop'])) {
      this.scroller.scrollBy(isHoriz ? delta : 0, isHoriz ? 0 : delta, true);
    }

    return false;
  }
});

})();



(function() {

})();



if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  Ember.Logger.warn("You are running a production build of Ember on localhost and won't receive detailed error messages. "+
               "If you want full error messages please use the non-minified build provided on the Ember website.");
}
