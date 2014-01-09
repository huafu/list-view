var css, view, helper, nextLeftPosition;

require('list-view/~tests/test_helper');
helper = window.helper;
nextLeftPosition = 0;

function Scroller(callback, opts){
  this.callback = callback;
  this.opts = opts;
  this.scrollTo = function(left, top, zoom) {
    view._scrollerOffset = left;
    view._scrollContentTo(Math.max(0, left));
  };
  this.setDimensions = function() { };
  this.doTouchStart = function() {};
  this.doTouchMove = function() {
    this.scrollTo(nextLeftPosition, 0, 1);
  };
  this.doTouchEnd = function() {};
}


function appendView() {
  Ember.run(function() {
    view.appendTo('#qunit-fixture');
  });
}

function fireEvent(type, target) {
  var hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof window.DocumentTouch,
    events = hasTouch ? {
      start: 'touchstart',
      move: 'touchmove',
      end: 'touchend'
    } : {
      start: 'mousedown',
      move: 'mousemove',
      end: 'mouseend'
    },
    e = document.createEvent('Event');
  if (hasTouch) {
    e.touches = [{target: target}];
  } else {
    e.which = 1;
  }
  e.initEvent(events[type], true, true);
  target.dispatchEvent(e);
}

module("Ember.VirtualListView (horizontal) scrollerstart acceptance", {
  setup: function() {
    window.Scroller = Scroller;
    css = Ember.$("<style>" +
            ".ember-list-view {" +
            "  overflow: auto;" +
            "  position: relative;" +
            "}" +
            ".ember-list-item-view {" +
            "  position: absolute;" +
            "}" +
            ".is-selected {" +
            "  background: red;" +
            "}" +
            "</style>").appendTo('head');
  },
  teardown: function() {
    css.remove();

    Ember.run(function() {
      if (view) { view.destroy(); }
    });
  }
});

test("When scrolling begins, fire a scrollerstart event on the original target", function() {
  expect(1);
  view = Ember.VirtualListView.create({
    isHorizontal: true,
    content: helper.generateContent(4),
    width: 150,
    columnWidth: 50
  });

  appendView();

  var childElement = view.$('.ember-list-item-view')[0];
  Ember.$(document).on("scrollerstart", function(e){
    ok(e.target === childElement, "fired scrollerstart on original target");
  });

  Ember.run(function(){
    nextLeftPosition = nextLeftPosition + 1;
    fireEvent('start', childElement);
    fireEvent('move', childElement);
  });

  Ember.$(document).off("scrollerstart");
});

test("fire scrollerstart event only once per scroll session", function() {
  view = Ember.VirtualListView.create({
    isHorizontal: true,
    content: helper.generateContent(4),
    width: 150,
    columnWidth: 50
  });

  appendView();

  var childElement = view.$('.ember-list-item-view')[0],
      scrollerstartCount = 0;

  Ember.$(document).on("scrollerstart", function(e){
    scrollerstartCount = scrollerstartCount + 1;
  });

  Ember.run(function(){
    nextLeftPosition = nextLeftPosition + 1;

    fireEvent('start', childElement);
    fireEvent('move', childElement);
    fireEvent('move', childElement);
  });

  equal(scrollerstartCount, 1, "scrollerstart should fire only once per scroll session");

  Ember.run(function(){
    fireEvent('end', childElement);
    nextLeftPosition = nextLeftPosition + 1;
    fireEvent('start', childElement);
    fireEvent('move', childElement);
  });

  equal(scrollerstartCount, 2, "scrollerstart should fire again for a new scroll session");

  Ember.$(document).off("scrollerstart");
});

test("doesn't fire scrollerstart event when view did not actually scroll horizontally", function() {
  view = Ember.VirtualListView.create({
    isHorizontal: true,
    content: helper.generateContent(4),
    width: 150,
    columnWidth: 50
  });

  appendView();

  var childElement = view.$('.ember-list-item-view')[0],
      scrollerstartCount = 0;

  Ember.$(document).on("scrollerstart", function(e){
    scrollerstartCount = scrollerstartCount + 1;
  });

  Ember.run(function(){
    nextLeftPosition = 0;
    fireEvent('start', childElement);
    fireEvent('move', childElement);
  });

  equal(scrollerstartCount, 0, "scrollerstart should not fire if view did not scroll");

  Ember.run(function(){
    nextLeftPosition = nextLeftPosition + 1;
    fireEvent('move', childElement);
  });

  equal(scrollerstartCount, 1, "scrollerstart should fire if view scrolled");

  Ember.$(document).off("scrollerstart");
});

test("When pulling below zero, still fire a scrollerstart event", function() {
  expect(1);
  view = Ember.VirtualListView.create({
    isHorizontal: true,
    content: helper.generateContent(4),
    width: 150,
    columnWidth: 50
  });

  appendView();

  var childElement = view.$('.ember-list-item-view')[0];
  Ember.$(document).on("scrollerstart", function(e){
    ok(true, "fired scrollerstart");
  });

  Ember.run(function(){
    nextLeftPosition = nextLeftPosition - 10;
    fireEvent('start', childElement);
    fireEvent('move', childElement);
  });

  Ember.$(document).off("scrollerstart");
});

